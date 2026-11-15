import { createHmac } from 'node:crypto';
import {
  addMoney,
  compareMoney,
  Decimal,
  mulMoney,
  toDecimal,
  toFixedDecimalString,
} from '@sure/shared';
import { getExchangeRate, parseIsoDate, prisma } from '../../../config/prisma.js';
import { AppError } from '../../../middleware/pipeline.js';
import { BalanceService } from '../../balances/balance.service.js';
import { StoredConnectionConfig } from '../sync.adapters.js';

const STABLECOINS_USD = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD', 'USDP']);

export interface BinanceBalanceRaw {
  asset: string;
  free: string;
  locked: string;
}

export interface BinanceTickerRaw {
  symbol: string;
  price: string;
}

export interface ParsedBinanceAsset {
  asset: string;
  qty: string;
  unitPriceUsd: string;
  unitPriceAccountCurrency: string;
  marketValueAccountCurrency: string;
}

export function buildBinanceSignature(queryString: string, apiSecret: string): string {
  return createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

function resolveAssetPriceUsd(
  asset: string,
  priceMap: Map<string, string>,
  usdToIdrRate: string
): string {
  const sym = asset.toUpperCase();
  if (STABLECOINS_USD.has(sym) || sym === 'USD') {
    return '1.0000';
  }
  if (sym === 'IDR' || sym === 'BIDR') {
    const rate = toDecimal(usdToIdrRate);
    return rate.greaterThan(0)
      ? new Decimal(1).dividedBy(rate).toFixed(4, Decimal.ROUND_HALF_EVEN)
      : '0.0000';
  }

  for (const quote of ['USDT', 'USDC', 'FDUSD', 'BUSD']) {
    const direct = priceMap.get(`${sym}${quote}`);
    if (direct) return toFixedDecimalString(direct);
  }

  const btcCross = priceMap.get(`${sym}BTC`);
  const btcUsd = priceMap.get('BTCUSDT') ?? priceMap.get('BTCUSDC');
  if (btcCross && btcUsd) {
    return mulMoney(btcCross, btcUsd);
  }

  const ethCross = priceMap.get(`${sym}ETH`);
  const ethUsd = priceMap.get('ETHUSDT') ?? priceMap.get('ETHUSDC');
  if (ethCross && ethUsd) {
    return mulMoney(ethCross, ethUsd);
  }

  return '0.0000';
}

/**
 * Converts Binance spot balances into Decimal-exact holding valuations.
 */
export function parseBinanceSpotAssets(params: {
  balances: BinanceBalanceRaw[];
  tickers: BinanceTickerRaw[];
  accountCurrency: string;
  usdToAccountRate: string;
  usdToIdrRate?: string;
}): { assets: ParsedBinanceAsset[]; totalAccountValue: string } {
  const priceMap = new Map<string, string>();
  for (const t of params.tickers) {
    if (t.symbol && t.price) {
      priceMap.set(t.symbol.toUpperCase(), t.price);
    }
  }

  const targetCurrency = params.accountCurrency.toUpperCase();
  const usdToIdr = params.usdToIdrRate ?? '15800.0000';
  const assets: ParsedBinanceAsset[] = [];
  let total = '0.0000';

  for (const bal of params.balances) {
    const asset = bal.asset.trim().toUpperCase();
    if (!asset) continue;

    const totalQtyDec = toDecimal(bal.free || '0').plus(toDecimal(bal.locked || '0'));
    if (totalQtyDec.lessThanOrEqualTo(0)) continue;

    const qty = totalQtyDec.toFixed(8, Decimal.ROUND_HALF_EVEN);
    const unitPriceUsd = resolveAssetPriceUsd(asset, priceMap, usdToIdr);
    const unitPriceAccountCurrency =
      targetCurrency === 'USD' || targetCurrency === 'USDT'
        ? unitPriceUsd
        : mulMoney(unitPriceUsd, params.usdToAccountRate);
    const marketValueAccountCurrency = mulMoney(qty, unitPriceAccountCurrency);

    assets.push({
      asset,
      qty,
      unitPriceUsd,
      unitPriceAccountCurrency,
      marketValueAccountCurrency,
    });
    total = addMoney(total, marketValueAccountCurrency);
  }

  assets.sort((a, b) => compareMoney(b.marketValueAccountCurrency, a.marketValueAccountCurrency));
  return { assets, totalAccountValue: total };
}

export async function syncBinanceConnection(params: {
  familyId: string;
  connectionId: string;
  institutionName: string;
  config: StoredConnectionConfig;
  fetchImpl?: typeof fetch;
}): Promise<{
  providerKey: 'binance';
  accountId: string;
  currency: string;
  totalValue: string;
  assetsSynced: number;
  message: string;
}> {
  const { familyId, connectionId, institutionName, config } = params;
  const fetchFn = params.fetchImpl ?? fetch;

  if (!config.apiKey || !config.apiSecret) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Binance API Key and API Secret are required. Click Configure on this connection to set read-only credentials.'
    );
  }

  const baseUrl = config.useTestnet
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com';
  const queryString = `timestamp=${Date.now()}&recvWindow=5000`;
  const signature = buildBinanceSignature(queryString, config.apiSecret);

  const [accountRes, tickersRes] = await Promise.all([
    fetchFn(`${baseUrl}/api/v3/account?${queryString}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': config.apiKey },
      signal: AbortSignal.timeout(8000),
    }),
    fetchFn(`${baseUrl}/api/v3/ticker/price`, {
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  if (!accountRes.ok) {
    const errText = await accountRes.text();
    let msg = `Binance API HTTP ${accountRes.status}`;
    try {
      const parsed = JSON.parse(errText) as { msg?: string; code?: number };
      if (parsed.msg) msg = `Binance API (${parsed.code ?? accountRes.status}): ${parsed.msg}`;
    } catch {
      if (errText) msg = `${msg}: ${errText.slice(0, 140)}`;
    }
    throw new AppError('VALIDATION_ERROR', msg);
  }

  if (!tickersRes.ok) {
    throw new AppError('INTERNAL_ERROR', `Failed to fetch Binance ticker prices (HTTP ${tickersRes.status})`);
  }

  const accountJson = (await accountRes.json()) as { balances?: BinanceBalanceRaw[] };
  const tickersJson = (await tickersRes.json()) as BinanceTickerRaw[];

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { baseCurrency: true },
  });

  const requestedCurrency = (config.quoteCurrency || family?.baseCurrency || 'USD').toUpperCase();
  const accountCurrency = requestedCurrency === 'USDT' ? 'USD' : requestedCurrency;

  let targetAccount = config.targetAccountId
    ? await prisma.account.findFirst({
        where: { id: config.targetAccountId, familyId },
      })
    : await prisma.account.findFirst({
        where: { familyId, providerConnectionId: connectionId },
      });

  if (!targetAccount) {
    targetAccount = await prisma.account.create({
      data: {
        familyId,
        name: institutionName || 'Binance Spot',
        accountType: 'CRYPTO',
        classification: 'ASSET',
        currency: accountCurrency,
        balance: '0.0000',
        color: '#f59e0b',
        icon: 'Bitcoin',
        providerConnectionId: connectionId,
        subtypeDetails: { walletType: 'EXCHANGE', exchange: 'Binance' },
      },
    });
  } else if (targetAccount.providerConnectionId !== connectionId) {
    targetAccount = await prisma.account.update({
      where: { id: targetAccount.id },
      data: { providerConnectionId: connectionId },
    });
  }

  const usdToAccountRate =
    targetAccount.currency.toUpperCase() === 'USD'
      ? '1.0000'
      : await getExchangeRate('USD', targetAccount.currency);
  const usdToIdrRate = await getExchangeRate('USD', 'IDR');

  const { assets, totalAccountValue } = parseBinanceSpotAssets({
    balances: accountJson.balances ?? [],
    tickers: Array.isArray(tickersJson) ? tickersJson : [],
    accountCurrency: targetAccount.currency,
    usdToAccountRate,
    usdToIdrRate,
  });

  for (const item of assets) {
    const security = await prisma.security.upsert({
      where: { ticker: item.asset },
      update: {
        assetClass: 'CRYPTO',
        currentPrice: item.unitPriceUsd,
        currency: 'USD',
      },
      create: {
        ticker: item.asset,
        name: `${item.asset} (Binance)`,
        assetClass: 'CRYPTO',
        currency: 'USD',
        currentPrice: item.unitPriceUsd,
      },
    });

    const existingHolding = await prisma.holding.findUnique({
      where: {
        accountId_securityId: { accountId: targetAccount.id, securityId: security.id },
      },
    });

    await prisma.holding.upsert({
      where: {
        accountId_securityId: { accountId: targetAccount.id, securityId: security.id },
      },
      update: {
        qty: item.qty,
        marketValue: item.marketValueAccountCurrency,
      },
      create: {
        accountId: targetAccount.id,
        securityId: security.id,
        qty: item.qty,
        avgCostBasis: item.unitPriceAccountCurrency,
        marketValue: item.marketValueAccountCurrency,
      },
    });

    if (existingHolding && compareMoney(item.qty, '0.0000') === 0) {
      await prisma.holding.delete({ where: { id: existingHolding.id } });
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const valuationExternalId = `binance_val_${connectionId}_${todayIso}`;
  const existingVal = await prisma.entry.findFirst({
    where: {
      familyId,
      accountId: targetAccount.id,
      externalId: valuationExternalId,
    },
    select: { id: true },
  });

  if (existingVal) {
    await prisma.entry.update({
      where: { id: existingVal.id },
      data: {
        amount: totalAccountValue,
        currency: targetAccount.currency,
        notes: `Binance Spot sync (${assets.length} assets)`,
      },
    });
  } else {
    await prisma.entry.create({
      data: {
        familyId,
        accountId: targetAccount.id,
        entryType: 'VALUATION',
        date: parseIsoDate(todayIso),
        amount: totalAccountValue,
        currency: targetAccount.currency,
        name: 'Binance Spot Portfolio Valuation',
        notes: `Binance Spot sync (${assets.length} assets)`,
        excluded: false,
        externalId: valuationExternalId,
        valuation: { create: { kind: 'RECONCILIATION' } },
      },
    });
  }

  await BalanceService.materializeAccount(familyId, targetAccount.id);

  return {
    providerKey: 'binance',
    accountId: targetAccount.id,
    currency: targetAccount.currency,
    totalValue: totalAccountValue,
    assetsSynced: assets.length,
    message: `Synced ${assets.length} Binance asset(s) totaling ${totalAccountValue} ${targetAccount.currency}.`,
  };
}
