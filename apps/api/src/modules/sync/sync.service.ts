import {
  compareMoney,
  CreateProviderConnectionInput,
  divMoney,
  isZeroMoney,
  MarketHistoryQueryInput,
  mulMoney,
  ResolveFinancekitConflictInput,
  subMoney,
  toFixedDecimalString,
  UpdateProviderConnectionInput,
} from '@sure/shared';
import { decimalToFixed, parseIsoDate, prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { BalanceService } from '../balances/balance.service.js';
import {
  decodeConnectionConfig,
  encodeConnectionConfig,
  findAdapterInfo,
  mergeConnectionConfig,
  PROVIDER_ADAPTER_CATALOG,
  sanitizeConnectionForClient,
  StoredConnectionConfig,
} from './sync.adapters.js';
import { syncBinanceConnection } from './adapters/binance.adapter.js';
import { syncFrankfurterConnection } from './adapters/frankfurter.adapter.js';
import {
  fetchFxMarketHistory,
  fetchSecurityMarketHistory,
} from './adapters/market-history.adapter.js';
import {
  parseYahooChartResponse,
  syncYahooFinanceConnection,
} from './adapters/yahoo.adapter.js';

export { PROVIDER_ADAPTER_CATALOG };
export type { ProviderAdapterInfo, SanitizedProviderConnectionDto } from './sync.adapters.js';

export interface SyncRunItemResult {
  connectionId: string;
  providerKey: string;
  institutionName: string;
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export class SyncService {
  public async getSyncOverview(familyId: string) {
    const [
      family,
      connections,
      conflicts,
      linkedAccounts,
      securities,
      allFxRates,
      rawFamilyHoldings,
    ] = await Promise.all([
      prisma.family.findUnique({
        where: { id: familyId },
        select: { baseCurrency: true },
      }),
      prisma.providerConnection.findMany({
        where: { familyId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.financekitConflict.findMany({
        where: { familyId, resolvedAt: null },
        include: { batch: { include: { providerConnection: true } } },
      }),
      prisma.account.findMany({
        where: { familyId, providerConnectionId: { not: null } },
        select: { id: true, providerConnectionId: true },
      }),
      prisma.security.findMany({
        orderBy: [{ assetClass: 'asc' }, { ticker: 'asc' }],
        take: 60,
      }),
      prisma.exchangeRate.findMany({
        orderBy: [{ date: 'desc' }, { baseCurrency: 'asc' }, { targetCurrency: 'asc' }],
        distinct: ['baseCurrency', 'targetCurrency'],
        take: 200,
      }),
      prisma.holding.findMany({
        where: { account: { familyId } },
        include: {
          security: true,
          account: { select: { id: true, name: true, accountType: true, currency: true } },
        },
        orderBy: { marketValue: 'desc' },
      }),
    ]);

    const linkedByConnection = new Map<string, string>();
    for (const acc of linkedAccounts) {
      if (acc.providerConnectionId && !linkedByConnection.has(acc.providerConnectionId)) {
        linkedByConnection.set(acc.providerConnectionId, acc.id);
      }
    }

    const latestFxByPair = new Map<
      string,
      { baseCurrency: string; targetCurrency: string; date: string; rate: string }
    >();
    const baseCurr = (family?.baseCurrency || 'IDR').toUpperCase();
    for (const fx of allFxRates) {
      const pairKey = `${fx.baseCurrency}:${fx.targetCurrency}`;
      if (latestFxByPair.has(pairKey)) continue;
      latestFxByPair.set(pairKey, {
        baseCurrency: fx.baseCurrency,
        targetCurrency: fx.targetCurrency,
        date: fx.date.toISOString().slice(0, 10),
        rate: fx.rate.toFixed(8),
      });
    }

    const exchangeRates = Array.from(latestFxByPair.values()).sort((a, b) => {
      const aTouchesBase = a.targetCurrency === baseCurr || a.baseCurrency === baseCurr ? 0 : 1;
      const bTouchesBase = b.targetCurrency === baseCurr || b.baseCurrency === baseCurr ? 0 : 1;
      if (aTouchesBase !== bTouchesBase) return aTouchesBase - bTouchesBase;
      return `${a.baseCurrency}/${a.targetCurrency}`.localeCompare(
        `${b.baseCurrency}/${b.targetCurrency}`
      );
    });

    return {
      adapters: PROVIDER_ADAPTER_CATALOG,
      connections: connections.map((c) =>
        sanitizeConnectionForClient(c, linkedByConnection.get(c.id) ?? null)
      ),
      pendingConflicts: conflicts.map((c) => ({
        id: c.id,
        familyId: c.familyId,
        batchId: c.batchId,
        providerName: c.batch.providerConnection.institutionName,
        conflictType: c.conflictType,
        incomingSummary: c.incomingSummary as {
          externalId: string;
          date: string;
          name: string;
          amount: string;
          currency: string;
          accountName: string;
        },
        existingEntryId: c.existingEntryId,
        resolution: c.resolution,
        resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
      })),
      marketQuotes: securities.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        name: s.name,
        currency: s.currency,
        currentPrice: decimalToFixed(s.currentPrice),
        assetClass: s.assetClass,
      })),
      exchangeRates: exchangeRates.slice(0, 100),
      familyHoldings: rawFamilyHoldings.map((h) => {
        const qty = decimalToFixed(h.qty, 8);
        const avgCostBasis = decimalToFixed(h.avgCostBasis);
        const currentPrice = decimalToFixed(h.security.currentPrice);
        const storedMv = decimalToFixed(h.marketValue);
        const marketValue =
          !isZeroMoney(currentPrice) && h.security.currency === h.account.currency
            ? mulMoney(qty, currentPrice)
            : storedMv;
        const costBasisTotal = mulMoney(qty, avgCostBasis);
        const unrealizedGain = subMoney(marketValue, costBasisTotal);
        const returnPercent =
          compareMoney(costBasisTotal, '0.0000') > 0
            ? divMoney(mulMoney(unrealizedGain, '100.0000'), costBasisTotal)
            : '0.0000';
        return {
          id: h.id,
          accountId: h.account.id,
          accountName: h.account.name,
          accountType: h.account.accountType,
          currency: h.account.currency,
          ticker: h.security.ticker,
          securityName: h.security.name,
          assetClass: h.security.assetClass,
          qty,
          avgCostBasis,
          currentPrice,
          marketValue,
          costBasisTotal,
          unrealizedGain,
          returnPercent,
        };
      }),
    };
  }

  /**
   * Idempotent provider sync ingestion through FinanceKit Staging & Conflict Resolver.
   * Re-running with the same externalId will not create duplicate entries (05-testing-guidelines.md #4).
   */
  public async ingestExternalTransactions(
    familyId: string,
    accountId: string,
    items: Array<{ externalId: string; date: string; name: string; amount: string; currency: string }>
  ) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, familyId },
    });
    if (!account) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }

    let insertedCount = 0;
    let skippedIdempotentCount = 0;

    for (const item of items) {
      const alreadyExists = await prisma.entry.findFirst({
        where: {
          familyId,
          accountId,
          externalId: item.externalId,
        },
        select: { id: true },
      });
      if (alreadyExists) {
        skippedIdempotentCount++;
        continue;
      }

      await prisma.entry.create({
        data: {
          accountId,
          familyId,
          entryType: 'TRANSACTION',
          date: parseIsoDate(item.date),
          amount: toFixedDecimalString(item.amount),
          currency: item.currency.toUpperCase(),
          name: item.name,
          notes: 'Synced via FinanceKit',
          excluded: false,
          externalId: item.externalId,
          transaction: { create: {} },
        },
      });
      insertedCount++;
    }

    await BalanceService.materializeAccount(familyId, accountId);
    return { insertedCount, skippedIdempotentCount };
  }

  public async resolveConflict(familyId: string, input: ResolveFinancekitConflictInput) {
    const conflict = await prisma.financekitConflict.findFirst({
      where: { id: input.conflictId, familyId },
    });
    if (!conflict) {
      throw new AppError('NOT_FOUND', 'Conflict record not found');
    }

    const updated = await prisma.financekitConflict.update({
      where: { id: conflict.id },
      data: {
        resolution: input.resolution,
        resolvedAt: new Date(),
      },
    });

    if (input.resolution === 'KEEP_BOTH' && input.targetAccountId) {
      const incoming = conflict.incomingSummary as {
        externalId: string;
        date: string;
        name: string;
        amount: string;
        currency: string;
      };
      await this.ingestExternalTransactions(familyId, input.targetAccountId, [incoming]);
    }

    return updated;
  }

  private async validateTargetAccount(familyId: string, accountId?: string | null) {
    if (!accountId) return null;
    const account = await prisma.account.findFirst({
      where: { id: accountId, familyId },
      select: { id: true },
    });
    if (!account) {
      throw new AppError('NOT_FOUND', 'Target account not found');
    }
    return account.id;
  }

  private assertCredentialPairComplete(config: StoredConnectionConfig) {
    const hasKey = Boolean(config.apiKey?.trim());
    const hasSecret = Boolean(config.apiSecret?.trim());
    if (hasKey !== hasSecret) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Both API Key and API Secret must be provided together.'
      );
    }
  }

  public async createConnection(familyId: string, input: CreateProviderConnectionInput) {
    const adapter = findAdapterInfo(input.providerKey);
    if (!adapter) {
      throw new AppError('VALIDATION_ERROR', `Unknown provider adapter: ${input.providerKey}`);
    }

    const linkedAccountId = await this.validateTargetAccount(
      familyId,
      input.config?.targetAccountId ?? input.accountId
    );
    const mergedConfig = mergeConnectionConfig({}, {
      ...input.config,
      ...(linkedAccountId ? { targetAccountId: linkedAccountId } : {}),
    });
    this.assertCredentialPairComplete(mergedConfig);

    const encryptedCredentials = encodeConnectionConfig(mergedConfig);

    const created = await prisma.providerConnection.create({
      data: {
        familyId,
        providerKey: adapter.key,
        providerCategory: adapter.category,
        institutionName: input.institutionName.trim(),
        status: 'CONNECTED',
        lastSyncedAt: null,
        encryptedCredentials,
      },
    });

    if (linkedAccountId) {
      await prisma.account.update({
        where: { id: linkedAccountId },
        data: { providerConnectionId: created.id },
      });
    }

    return sanitizeConnectionForClient(created, linkedAccountId);
  }

  public async updateConnection(
    familyId: string,
    connectionId: string,
    input: UpdateProviderConnectionInput
  ) {
    const existing = await prisma.providerConnection.findFirst({
      where: { id: connectionId, familyId },
    });
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Provider connection not found');
    }

    const existingConfig = decodeConnectionConfig(existing.encryptedCredentials);
    const requestedAccountId =
      input.accountId !== undefined
        ? input.accountId
        : input.config?.targetAccountId !== undefined
          ? input.config.targetAccountId
          : undefined;

    if (requestedAccountId) {
      await this.validateTargetAccount(familyId, requestedAccountId);
    }

    const nextConfig = mergeConnectionConfig(existingConfig, input.config);
    if (input.accountId === null) {
      delete nextConfig.targetAccountId;
    } else if (requestedAccountId) {
      nextConfig.targetAccountId = requestedAccountId;
    }
    this.assertCredentialPairComplete(nextConfig);

    const updated = await prisma.providerConnection.update({
      where: { id: existing.id },
      data: {
        ...(input.institutionName ? { institutionName: input.institutionName.trim() } : {}),
        encryptedCredentials: encodeConnectionConfig(nextConfig),
      },
    });

    if (input.accountId === null) {
      await prisma.account.updateMany({
        where: { familyId, providerConnectionId: existing.id },
        data: { providerConnectionId: null },
      });
    } else if (requestedAccountId) {
      await prisma.account.updateMany({
        where: { familyId, providerConnectionId: existing.id, id: { not: requestedAccountId } },
        data: { providerConnectionId: null },
      });
      await prisma.account.update({
        where: { id: requestedAccountId },
        data: { providerConnectionId: existing.id },
      });
    }

    return sanitizeConnectionForClient(updated, nextConfig.targetAccountId ?? null);
  }

  public async deleteConnection(familyId: string, connectionId: string) {
    const existing = await prisma.providerConnection.findFirst({
      where: { id: connectionId, familyId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Provider connection not found');
    }

    await prisma.$transaction([
      prisma.account.updateMany({
        where: { familyId, providerConnectionId: existing.id },
        data: { providerConnectionId: null },
      }),
      prisma.providerConnection.delete({
        where: { id: existing.id },
      }),
    ]);

    return { deleted: true, id: existing.id };
  }

  public async getMarketHistory(
    input: MarketHistoryQueryInput,
    fetchImpl?: typeof fetch
  ) {
    if (input.kind === 'fx') {
      if (!input.from || !input.to) {
        throw new AppError('VALIDATION_ERROR', 'Both `from` and `to` currencies are required for FX history.');
      }
      return fetchFxMarketHistory({
        from: input.from,
        to: input.to,
        range: input.range,
        fetchImpl,
      });
    }

    if (!input.ticker) {
      throw new AppError('VALIDATION_ERROR', '`ticker` is required for security market history.');
    }
    return fetchSecurityMarketHistory({
      ticker: input.ticker,
      range: input.range,
      fetchImpl,
    });
  }

  public async addWatchlistTicker(
    familyId: string,
    rawTicker: string,
    fetchImpl?: typeof fetch
  ) {
    const ticker = rawTicker.trim().toUpperCase();
    const fetchFn = fetchImpl ?? fetch;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const res = await fetchFn(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SureFinance/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new AppError('VALIDATION_ERROR', `Ticker "${ticker}" not found on Yahoo Finance.`);
    }
    const json = await res.json();
    let parsed: ReturnType<typeof parseYahooChartResponse>;
    try {
      parsed = parseYahooChartResponse(json, ticker);
    } catch (err) {
      throw new AppError(
        'VALIDATION_ERROR',
        err instanceof Error ? err.message : `Invalid ticker "${ticker}"`
      );
    }

    const security = await prisma.security.upsert({
      where: { ticker: parsed.ticker },
      update: {
        name: parsed.name,
        currency: parsed.currency,
        currentPrice: parsed.currentPrice,
        assetClass: parsed.assetClass,
      },
      create: {
        ticker: parsed.ticker,
        name: parsed.name,
        currency: parsed.currency,
        currentPrice: parsed.currentPrice,
        assetClass: parsed.assetClass,
      },
    });

    const yahooConn = await prisma.providerConnection.findFirst({
      where: { familyId, providerKey: 'yahoo_finance' },
      orderBy: { createdAt: 'desc' },
    });

    if (yahooConn) {
      const existingConfig = decodeConnectionConfig(yahooConn.encryptedCredentials);
      const nextTickers = Array.from(new Set([...(existingConfig.tickers ?? []), parsed.ticker]));
      await prisma.providerConnection.update({
        where: { id: yahooConn.id },
        data: {
          lastSyncedAt: new Date(),
          encryptedCredentials: encodeConnectionConfig({
            ...existingConfig,
            tickers: nextTickers,
          }),
        },
      });
    } else {
      await prisma.providerConnection.create({
        data: {
          familyId,
          providerKey: 'yahoo_finance',
          providerCategory: 'MARKET_DATA',
          institutionName: 'Yahoo Finance Quotes',
          status: 'CONNECTED',
          lastSyncedAt: new Date(),
          encryptedCredentials: encodeConnectionConfig({ tickers: [parsed.ticker] }),
        },
      });
    }

    return {
      quote: {
        id: security.id,
        ticker: security.ticker,
        name: security.name,
        currency: security.currency,
        currentPrice: decimalToFixed(security.currentPrice),
        assetClass: security.assetClass,
      },
    };
  }

  private async executeAdapterSync(
    familyId: string,
    conn: {
      id: string;
      providerKey: string;
      institutionName: string;
      encryptedCredentials: string | null;
    },
    fetchImpl?: typeof fetch
  ): Promise<SyncRunItemResult> {
    const config = decodeConnectionConfig(conn.encryptedCredentials);

    if (conn.providerKey === 'binance') {
      const res = await syncBinanceConnection({
        familyId,
        connectionId: conn.id,
        institutionName: conn.institutionName,
        config,
        fetchImpl,
      });
      return {
        connectionId: conn.id,
        providerKey: conn.providerKey,
        institutionName: conn.institutionName,
        ok: true,
        message: res.message,
        details: res,
      };
    }

    if (conn.providerKey === 'yahoo_finance') {
      const res = await syncYahooFinanceConnection({
        familyId,
        config,
        fetchImpl,
      });
      return {
        connectionId: conn.id,
        providerKey: conn.providerKey,
        institutionName: conn.institutionName,
        ok: true,
        message: res.message,
        details: res,
      };
    }

    if (conn.providerKey === 'frankfurter_fx') {
      const res = await syncFrankfurterConnection({
        familyId,
        config,
        fetchImpl,
      });
      return {
        connectionId: conn.id,
        providerKey: conn.providerKey,
        institutionName: conn.institutionName,
        ok: true,
        message: res.message,
        details: res,
      };
    }

    return {
      connectionId: conn.id,
      providerKey: conn.providerKey,
      institutionName: conn.institutionName,
      ok: true,
      message: `${conn.institutionName} ledger state refreshed (catalog adapter).`,
    };
  }

  public async runConnectionSync(
    familyId: string,
    connectionId: string,
    fetchImpl?: typeof fetch
  ) {
    const conn = await prisma.providerConnection.findFirst({
      where: { id: connectionId, familyId },
    });
    if (!conn) {
      throw new AppError('NOT_FOUND', 'Provider connection not found');
    }

    const result = await this.executeAdapterSync(familyId, conn, fetchImpl);
    const now = new Date();
    await prisma.providerConnection.update({
      where: { id: conn.id },
      data: { lastSyncedAt: now, status: 'CONNECTED' },
    });

    return {
      ...result,
      syncedAt: now.toISOString(),
    };
  }

  public async runSyncAll(familyId: string, fetchImpl?: typeof fetch) {
    const connections = await prisma.providerConnection.findMany({
      where: { familyId, status: 'CONNECTED' },
    });

    const now = new Date();
    const results: SyncRunItemResult[] = [];
    const errors: Array<{ connectionId: string; institutionName: string; message: string }> = [];

    // Sync market/FX providers before portfolio adapters so FX rates are fresh for multi-currency balances
    const ordered = [...connections].sort((a, b) => {
      const rank = (k: string) => (k === 'frankfurter_fx' ? 0 : k === 'yahoo_finance' ? 1 : 2);
      return rank(a.providerKey) - rank(b.providerKey);
    });

    for (const conn of ordered) {
      try {
        const res = await this.executeAdapterSync(familyId, conn, fetchImpl);
        results.push(res);
        await prisma.providerConnection.update({
          where: { id: conn.id },
          data: { lastSyncedAt: now },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        errors.push({
          connectionId: conn.id,
          institutionName: conn.institutionName,
          message,
        });
        results.push({
          connectionId: conn.id,
          providerKey: conn.providerKey,
          institutionName: conn.institutionName,
          ok: false,
          message,
        });
      }
    }

    const accounts = await prisma.account.findMany({
      where: { familyId },
      select: { id: true },
    });
    for (const acc of accounts) {
      await BalanceService.materializeAccount(familyId, acc.id);
    }

    return {
      syncedConnections: results.filter((r) => r.ok).length,
      materializedAccounts: accounts.length,
      syncedAt: now.toISOString(),
      results,
      errors,
    };
  }
}

export const syncService = new SyncService();
