import { mulMoney, toDecimal, toFixedDecimalString } from '@sure/shared';
import { getExchangeRate, prisma } from '../../../config/prisma.js';
import { AppError } from '../../../middleware/pipeline.js';
import { BalanceService } from '../../balances/balance.service.js';
import { StoredConnectionConfig } from '../sync.adapters.js';

export const DEFAULT_MARKET_WATCHLIST = [
  'BBCA.JK',
  'BBRI.JK',
  'BMRI.JK',
  'TLKM.JK',
  'VOO',
  'AAPL',
];

export interface ParsedYahooQuote {
  ticker: string;
  name: string;
  currency: string;
  currentPrice: string;
  assetClass: string;
}

interface YahooChartMeta {
  symbol?: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  instrumentType?: string;
  regularMarketPrice?: number | string;
}

interface YahooChartPayload {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
    }> | null;
    error?: { description?: string } | null;
  };
}

function resolveAssetClass(ticker: string, instrumentType?: string): string {
  const kind = (instrumentType ?? '').toUpperCase();
  if (kind === 'CRYPTOCURRENCY' || ticker.endsWith('-USD')) return 'CRYPTO';
  if (kind === 'ETF') return 'ETF';
  return 'EQUITY';
}

/**
 * Parses Yahoo Finance v8 chart JSON into Decimal-formatted quote fields.
 */
export function parseYahooChartResponse(
  payload: unknown,
  fallbackTicker: string
): ParsedYahooQuote {
  const data = payload as YahooChartPayload;
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice === undefined || meta.regularMarketPrice === null) {
    const errMsg = data?.chart?.error?.description || `No market price returned for ${fallbackTicker}`;
    throw new Error(errMsg);
  }

  const priceStr = String(meta.regularMarketPrice);
  const priceDec = toDecimal(priceStr);
  const ticker = (meta.symbol || fallbackTicker).trim().toUpperCase();
  const currency = (meta.currency || (ticker.endsWith('.JK') ? 'IDR' : 'USD'))
    .trim()
    .toUpperCase()
    .slice(0, 3);

  return {
    ticker,
    name: (meta.shortName || meta.longName || ticker).trim().slice(0, 120),
    currency,
    currentPrice: toFixedDecimalString(priceDec),
    assetClass: resolveAssetClass(ticker, meta.instrumentType),
  };
}

export async function syncYahooFinanceConnection(params: {
  familyId: string;
  config: StoredConnectionConfig;
  fetchImpl?: typeof fetch;
}): Promise<{
  providerKey: 'yahoo_finance';
  tickersRequested: number;
  tickersUpdated: number;
  failedTickers: string[];
  quotes: ParsedYahooQuote[];
  message: string;
}> {
  const fetchFn = params.fetchImpl ?? fetch;

  const familyHoldings = await prisma.holding.findMany({
    where: { account: { familyId: params.familyId } },
    include: { security: true, account: { select: { id: true, currency: true } } },
  });

  const tickerSet = new Set<string>();
  for (const t of params.config.tickers ?? []) {
    const cleaned = t.trim().toUpperCase();
    if (cleaned) tickerSet.add(cleaned);
  }
  for (const h of familyHoldings) {
    if (h.security.assetClass !== 'CRYPTO') {
      tickerSet.add(h.security.ticker.toUpperCase());
    }
  }
  if (tickerSet.size === 0) {
    for (const def of DEFAULT_MARKET_WATCHLIST) {
      tickerSet.add(def);
    }
  }

  const tickers = Array.from(tickerSet);
  const quotes: ParsedYahooQuote[] = [];
  const failedTickers: string[] = [];

  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
      const res = await fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SureFinance/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        failedTickers.push(ticker);
        continue;
      }
      const json = await res.json();
      const parsed = parseYahooChartResponse(json, ticker);
      quotes.push(parsed);

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

      const matchingHoldings = familyHoldings.filter(
        (h) => h.security.ticker.toUpperCase() === parsed.ticker
      );
      for (const h of matchingHoldings) {
        const fx =
          parsed.currency === h.account.currency.toUpperCase()
            ? '1.0000'
            : await getExchangeRate(parsed.currency, h.account.currency);
        const unitPriceInAccountCurrency = mulMoney(parsed.currentPrice, fx);
        const nextMarketValue = mulMoney(h.qty.toString(), unitPriceInAccountCurrency);
        await prisma.holding.update({
          where: { id: h.id },
          data: { securityId: security.id, marketValue: nextMarketValue },
        });
      }
    } catch {
      failedTickers.push(ticker);
    }
  }

  if (quotes.length === 0 && tickers.length > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Could not retrieve quotes from Yahoo Finance for: ${failedTickers.join(', ')}`
    );
  }

  const touchedAccountIds = new Set(
    familyHoldings
      .filter((h) => quotes.some((q) => q.ticker === h.security.ticker.toUpperCase()))
      .map((h) => h.accountId)
  );
  for (const accountId of touchedAccountIds) {
    await BalanceService.materializeAccount(params.familyId, accountId);
  }

  return {
    providerKey: 'yahoo_finance',
    tickersRequested: tickers.length,
    tickersUpdated: quotes.length,
    failedTickers,
    quotes,
    message: `Updated ${quotes.length} of ${tickers.length} market quote(s) via Yahoo Finance.`,
  };
}
