import {
  CreateProviderConnectionSchema,
  ResolveFinancekitConflictInput,
  toFixedDecimalString,
} from '@sure/shared';
import { z } from 'zod';
import { parseIsoDate, prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { BalanceService } from '../balances/balance.service.js';

export interface ProviderAdapterInfo {
  key: string;
  name: string;
  category: 'BANKING' | 'CRYPTO' | 'BROKERAGE' | 'MARKET_DATA';
  regions: string[];
  supportsWebhooks: boolean;
}

export const PROVIDER_ADAPTER_CATALOG: ProviderAdapterInfo[] = [
  { key: 'plaid', name: 'Plaid', category: 'BANKING', regions: ['US', 'CA', 'UK', 'EU'], supportsWebhooks: true },
  { key: 'truelayer', name: 'TrueLayer', category: 'BANKING', regions: ['UK', 'EU'], supportsWebhooks: true },
  { key: 'enable_banking', name: 'Enable Banking', category: 'BANKING', regions: ['EU'], supportsWebhooks: false },
  { key: 'simplefin', name: 'SimpleFIN Bridge', category: 'BANKING', regions: ['US', 'CA'], supportsWebhooks: false },
  { key: 'akahu', name: 'Akahu', category: 'BANKING', regions: ['NZ'], supportsWebhooks: true },
  { key: 'wise', name: 'Wise Multi-Currency', category: 'BANKING', regions: ['GLOBAL'], supportsWebhooks: true },
  { key: 'mercury', name: 'Mercury', category: 'BANKING', regions: ['US'], supportsWebhooks: true },
  { key: 'brex', name: 'Brex', category: 'BANKING', regions: ['US'], supportsWebhooks: true },
  { key: 'monobank', name: 'Monobank', category: 'BANKING', regions: ['UA'], supportsWebhooks: true },
  { key: 'up_bank', name: 'Up Bank', category: 'BANKING', regions: ['AU'], supportsWebhooks: true },
  { key: 'coinbase', name: 'Coinbase', category: 'CRYPTO', regions: ['GLOBAL'], supportsWebhooks: true },
  { key: 'binance', name: 'Binance', category: 'CRYPTO', regions: ['GLOBAL'], supportsWebhooks: false },
  { key: 'kraken', name: 'Kraken', category: 'CRYPTO', regions: ['GLOBAL'], supportsWebhooks: false },
  { key: 'evm_wallet', name: 'EVM On-Chain Wallet (Ethereum/L2)', category: 'CRYPTO', regions: ['GLOBAL'], supportsWebhooks: false },
  { key: 'solana_wallet', name: 'Solana On-Chain Wallet', category: 'CRYPTO', regions: ['GLOBAL'], supportsWebhooks: false },
  { key: 'bitcoin_xpub', name: 'Bitcoin Wallet', category: 'CRYPTO', regions: ['GLOBAL'], supportsWebhooks: false },
  { key: 'ibkr', name: 'Interactive Brokers (IBKR)', category: 'BROKERAGE', regions: ['GLOBAL'], supportsWebhooks: false },
  { key: 'questrade', name: 'Questrade', category: 'BROKERAGE', regions: ['CA'], supportsWebhooks: false },
  { key: 'trading212', name: 'Trading 212', category: 'BROKERAGE', regions: ['UK', 'EU'], supportsWebhooks: false },
  { key: 'trade_republic', name: 'Trade Republic', category: 'BROKERAGE', regions: ['EU'], supportsWebhooks: false },
  { key: 'yahoo_finance', name: 'Yahoo Finance Quotes', category: 'MARKET_DATA', regions: ['GLOBAL'], supportsWebhooks: false },
  { key: 'frankfurter_fx', name: 'Frankfurter ECB Exchange Rates', category: 'MARKET_DATA', regions: ['GLOBAL'], supportsWebhooks: false },
];

export class SyncService {
  public async getSyncOverview(familyId: string) {
    const [connections, conflicts] = await Promise.all([
      prisma.providerConnection.findMany({
        where: { familyId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.financekitConflict.findMany({
        where: { familyId, resolvedAt: null },
        include: { batch: { include: { providerConnection: true } } },
      }),
    ]);

    return {
      adapters: PROVIDER_ADAPTER_CATALOG,
      connections: connections.map((c) => ({
        ...c,
        lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
      })),
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

  public async createConnection(
    familyId: string,
    input: z.infer<typeof CreateProviderConnectionSchema>
  ) {
    const adapter = PROVIDER_ADAPTER_CATALOG.find((a) => a.key === input.providerKey);
    if (!adapter) {
      throw new AppError('VALIDATION_ERROR', `Unknown provider adapter: ${input.providerKey}`);
    }

    const created = await prisma.providerConnection.create({
      data: {
        familyId,
        providerKey: adapter.key,
        providerCategory: adapter.category,
        institutionName: input.institutionName,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    });

    return {
      ...created,
      lastSyncedAt: created.lastSyncedAt ? created.lastSyncedAt.toISOString() : null,
      createdAt: created.createdAt.toISOString(),
    };
  }

  public async runSyncAll(familyId: string) {
    const connections = await prisma.providerConnection.findMany({
      where: { familyId, status: 'CONNECTED' },
    });

    const now = new Date();
    for (const conn of connections) {
      await prisma.providerConnection.update({
        where: { id: conn.id },
        data: { lastSyncedAt: now },
      });
    }

    const accounts = await prisma.account.findMany({
      where: { familyId },
      select: { id: true },
    });
    for (const acc of accounts) {
      await BalanceService.materializeAccount(familyId, acc.id);
    }

    return {
      syncedConnections: connections.length,
      materializedAccounts: accounts.length,
      syncedAt: now.toISOString(),
    };
  }
}

export const syncService = new SyncService();
