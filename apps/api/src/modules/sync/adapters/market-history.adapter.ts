import {
  Decimal,
  divMoney,
  mulMoney,
  subMoney,
  toDecimal,
  toFixedDecimalString,
} from '@sure/shared';
import { AppError } from '../../../middleware/pipeline.js';

export type MarketHistoryRange = '5d' | '1mo' | '3mo' | '6mo' | '1y';

export interface MarketHistoryPoint {
  date: string;
  close: string;
}

export interface MarketHistoryResponseDto {
  kind: 'security' | 'fx';
  symbol: string;
  name: string;
  currency: string;
  range: MarketHistoryRange;
  latestClose: string;
  periodOpen: string;
  changeAmount: string;
  changePercent: string;
  periodHigh: string;
  periodLow: string;
  points: MarketHistoryPoint[];
}

function computeSeriesSummary(
  points: MarketHistoryPoint[],
  decimals = 4
): {
  latestClose: string;
  periodOpen: string;
  changeAmount: string;
  changePercent: string;
  periodHigh: string;
  periodLow: string;
} {
  if (points.length === 0) {
    const zero = toFixedDecimalString('0', decimals);
    return {
      latestClose: zero,
      periodOpen: zero,
      changeAmount: '0.0000',
      changePercent: '0.0000',
      periodHigh: zero,
      periodLow: zero,
    };
  }

  const periodOpen = points[0]!.close;
  const latestClose = points[points.length - 1]!.close;

  let highDec = toDecimal(periodOpen);
  let lowDec = toDecimal(periodOpen);
  for (const pt of points) {
    const d = toDecimal(pt.close);
    if (d.greaterThan(highDec)) highDec = d;
    if (d.lessThan(lowDec)) lowDec = d;
  }

  const changeAmount = subMoney(latestClose, periodOpen);
  const openDec = toDecimal(periodOpen);
  const changePercent = openDec.greaterThan(0)
    ? divMoney(mulMoney(changeAmount, '100.0000'), periodOpen)
    : '0.0000';

  return {
    latestClose,
    periodOpen,
    changeAmount,
    changePercent,
    periodHigh: highDec.toFixed(decimals, Decimal.ROUND_HALF_EVEN),
    periodLow: lowDec.toFixed(decimals, Decimal.ROUND_HALF_EVEN),
  };
}

interface YahooHistoryPayload {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        currency?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }> | null;
    error?: { description?: string } | null;
  };
}

export function parseYahooHistoryPayload(
  payload: unknown,
  fallbackTicker: string,
  range: MarketHistoryRange
): MarketHistoryResponseDto {
  const data = payload as YahooHistoryPayload;
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(data?.chart?.error?.description || `No chart history for ${fallbackTicker}`);
  }

  const meta = result.meta ?? {};
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: MarketHistoryPoint[] = [];
  const seenDates = new Set<string>();

  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    const closeVal = closes[i];
    if (typeof ts !== 'number' || closeVal === null || closeVal === undefined) continue;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    const formatted = toFixedDecimalString(String(closeVal));
    if (seenDates.has(date)) {
      points[points.length - 1] = { date, close: formatted };
    } else {
      seenDates.add(date);
      points.push({ date, close: formatted });
    }
  }

  const symbol = (meta.symbol || fallbackTicker).trim().toUpperCase();
  const currency = (meta.currency || (symbol.endsWith('.JK') ? 'IDR' : 'USD'))
    .trim()
    .toUpperCase()
    .slice(0, 3);
  const summary = computeSeriesSummary(points, 4);

  return {
    kind: 'security',
    symbol,
    name: (meta.shortName || meta.longName || symbol).trim(),
    currency,
    range,
    ...summary,
    points,
  };
}

interface FrankfurterRangePayload {
  base?: string;
  rates?: Record<string, Record<string, number | string>>;
}

export function parseFrankfurterHistoryPayload(
  payload: unknown,
  fromCurrency: string,
  toCurrency: string,
  range: MarketHistoryRange
): MarketHistoryResponseDto {
  const data = payload as FrankfurterRangePayload;
  const from = (data?.base || fromCurrency).trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  const rateEntries = Object.entries(data?.rates ?? {}).sort(([a], [b]) => a.localeCompare(b));

  const points: MarketHistoryPoint[] = [];
  for (const [date, map] of rateEntries) {
    const rawVal = map?.[to];
    if (rawVal === undefined || rawVal === null) continue;
    const dec = toDecimal(String(rawVal));
    if (dec.lessThanOrEqualTo(0)) continue;
    points.push({
      date: date.slice(0, 10),
      close: dec.toFixed(6, Decimal.ROUND_HALF_EVEN),
    });
  }

  const summary = computeSeriesSummary(points, 6);
  return {
    kind: 'fx',
    symbol: `${from}/${to}`,
    name: `${from} to ${to} Exchange Rate`,
    currency: to,
    range,
    ...summary,
    points,
  };
}

function getStartDateForRange(range: MarketHistoryRange): string {
  const now = new Date();
  const days =
    range === '5d'
      ? 7
      : range === '1mo'
        ? 31
        : range === '3mo'
          ? 92
          : range === '6mo'
            ? 183
            : 365;
  const start = new Date(now.getTime() - days * 86_400_000);
  return start.toISOString().slice(0, 10);
}

export async function fetchSecurityMarketHistory(params: {
  ticker: string;
  range: MarketHistoryRange;
  fetchImpl?: typeof fetch;
}): Promise<MarketHistoryResponseDto> {
  const fetchFn = params.fetchImpl ?? fetch;
  const rawTicker = params.ticker.trim().toUpperCase();
  const candidates =
    rawTicker.includes('.') || rawTicker.includes('-')
      ? [rawTicker]
      : [rawTicker, `${rawTicker}-USD`];

  const interval = params.range === '1y' || params.range === '6mo' ? '1wk' : '1d';

  for (const candidate of candidates) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?interval=${interval}&range=${params.range}`;
      const res = await fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SureFinance/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const parsed = parseYahooHistoryPayload(json, rawTicker, params.range);
      if (parsed.points.length > 0) {
        return { ...parsed, symbol: rawTicker };
      }
    } catch {
      // Try next symbol candidate
    }
  }

  // Fallback to Binance Klines for spot crypto symbols (e.g., ETH, BTC, SOL)
  if (!rawTicker.includes('.') && !rawTicker.includes('-')) {
    try {
      const limit =
        params.range === '5d'
          ? 5
          : params.range === '1mo'
            ? 30
            : params.range === '3mo'
              ? 90
              : params.range === '6mo'
                ? 180
                : 365;
      const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(rawTicker)}USDT&interval=1d&limit=${limit}`;
      const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const klines = (await res.json()) as Array<[number, string, string, string, string]>;
        if (Array.isArray(klines) && klines.length > 0) {
          const points: MarketHistoryPoint[] = klines.map((k) => ({
            date: new Date(k[0]).toISOString().slice(0, 10),
            close: toFixedDecimalString(String(k[4])),
          }));
          const summary = computeSeriesSummary(points, 4);
          return {
            kind: 'security',
            symbol: rawTicker,
            name: `${rawTicker} / USDT (Binance)`,
            currency: 'USD',
            range: params.range,
            ...summary,
            points,
          };
        }
      }
    } catch {
      // Fall through to error
    }
  }

  throw new AppError('NOT_FOUND', `Unable to load market history for ${rawTicker}`);
}

export async function fetchFxMarketHistory(params: {
  from: string;
  to: string;
  range: MarketHistoryRange;
  fetchImpl?: typeof fetch;
}): Promise<MarketHistoryResponseDto> {
  const fetchFn = params.fetchImpl ?? fetch;
  const from = params.from.trim().toUpperCase();
  const to = params.to.trim().toUpperCase();
  if (from === to) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      kind: 'fx',
      symbol: `${from}/${to}`,
      name: `${from} to ${to}`,
      currency: to,
      range: params.range,
      latestClose: '1.000000',
      periodOpen: '1.000000',
      changeAmount: '0.0000',
      changePercent: '0.0000',
      periodHigh: '1.000000',
      periodLow: '1.000000',
      points: [{ date: today, close: '1.000000' }],
    };
  }

  const startDate = getStartDateForRange(params.range);
  const endDate = new Date().toISOString().slice(0, 10);
  const url = `https://api.frankfurter.app/${startDate}..${endDate}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Unable to load FX history for ${from}/${to} (HTTP ${res.status})`
    );
  }
  const json = await res.json();
  return parseFrankfurterHistoryPayload(json, from, to, params.range);
}
