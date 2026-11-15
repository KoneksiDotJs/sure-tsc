import { convertCurrency, toDecimal } from '@sure/shared';
import type { WebExchangeRateItem, WebMarketQuote } from '../../lib/ledger/types.js';

export type SelectedMarketTarget =
  | { kind: 'security'; ticker: string }
  | { kind: 'fx'; from: string; to: string };

export type MarketCategoryFilter = 'all' | 'idx' | 'global' | 'crypto' | 'fx';

export function isIdxTicker(ticker: string): boolean {
  return ticker.trim().toUpperCase().endsWith('.JK');
}

export function isCryptoSecurity(quote: WebMarketQuote): boolean {
  const upperTicker = quote.ticker.trim().toUpperCase();
  return quote.assetClass.toUpperCase() === 'CRYPTO' || upperTicker.endsWith('-USD');
}

export function classifyQuoteGroup(quote: WebMarketQuote): 'idx' | 'crypto' | 'global' {
  if (isCryptoSecurity(quote)) return 'crypto';
  if (isIdxTicker(quote.ticker)) return 'idx';
  return 'global';
}

export function matchesMarketTarget(
  a: SelectedMarketTarget | null,
  b: SelectedMarketTarget
): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'security' && b.kind === 'security') {
    return a.ticker.toUpperCase() === b.ticker.toUpperCase();
  }
  if (a.kind === 'fx' && b.kind === 'fx') {
    return a.from.toUpperCase() === b.from.toUpperCase() && a.to.toUpperCase() === b.to.toUpperCase();
  }
  return false;
}

export function resolveDefaultMarketTarget(
  quotes: WebMarketQuote[],
  rates: WebExchangeRateItem[],
  baseCurrency: string
): SelectedMarketTarget | null {
  if (quotes.length > 0) {
    const idxFirst = quotes.find((q) => isIdxTicker(q.ticker));
    const chosen = idxFirst ?? quotes[0];
    if (chosen) {
      return { kind: 'security', ticker: chosen.ticker };
    }
  }

  if (rates.length > 0) {
    const base = baseCurrency.toUpperCase();
    const anchored =
      rates.find((r) => r.targetCurrency.toUpperCase() === base) ??
      rates.find((r) => r.baseCurrency.toUpperCase() === base) ??
      rates[0];
    if (anchored) {
      return {
        kind: 'fx',
        from: anchored.baseCurrency,
        to: anchored.targetCurrency,
      };
    }
  }

  return null;
}

export function formatFxRateDisplay(rate: string): string {
  try {
    const dec = toDecimal(rate);
    const abs = dec.abs();
    const digits = abs.gte(100) ? 2 : abs.gte(1) ? 4 : 6;
    const fixed = dec.toFixed(digits);
    const [intPart = '0', fracPart] = fixed.split('.');
    const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fracPart ? `${groupedInt}.${fracPart}` : groupedInt;
  } catch {
    return rate;
  }
}

export function findDirectOrCrossRateWithDate(
  rates: WebExchangeRateItem[],
  fromCurrency: string,
  toCurrency: string
): { rate: string; date: string | null } | null {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) return null;
  if (from === to) return { rate: '1.0000', date: null };

  const latestMap = new Map<string, { rate: string; date: string }>();
  for (const r of rates) {
    const key = `${r.baseCurrency.toUpperCase()}->${r.targetCurrency.toUpperCase()}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, { rate: r.rate, date: r.date });
    }
  }

  const direct = latestMap.get(`${from}->${to}`);
  if (direct) return direct;

  const inverse = latestMap.get(`${to}->${from}`);
  if (inverse) {
    const invDec = toDecimal(inverse.rate);
    if (!invDec.isZero()) {
      return { rate: toDecimal('1').div(invDec).toFixed(8), date: inverse.date };
    }
  }

  // Triangulate across common currency pivots present in cached rates
  const currencies = new Set<string>();
  for (const r of rates) {
    currencies.add(r.baseCurrency.toUpperCase());
    currencies.add(r.targetCurrency.toUpperCase());
  }

  const pivots = ['USD', 'EUR', 'IDR', 'SGD', ...currencies];
  for (const pivot of pivots) {
    if (pivot === from || pivot === to) continue;
    const fromToPivot =
      latestMap.get(`${from}->${pivot}`) ??
      (() => {
        const inv = latestMap.get(`${pivot}->${from}`);
        return inv && !toDecimal(inv.rate).isZero()
          ? { rate: toDecimal('1').div(toDecimal(inv.rate)).toFixed(10), date: inv.date }
          : null;
      })();
    const pivotToTarget =
      latestMap.get(`${pivot}->${to}`) ??
      (() => {
        const inv = latestMap.get(`${to}->${pivot}`);
        return inv && !toDecimal(inv.rate).isZero()
          ? { rate: toDecimal('1').div(toDecimal(inv.rate)).toFixed(10), date: inv.date }
          : null;
      })();

    if (fromToPivot && pivotToTarget) {
      return {
        rate: toDecimal(fromToPivot.rate).times(toDecimal(pivotToTarget.rate)).toFixed(8),
        date: fromToPivot.date >= pivotToTarget.date ? fromToPivot.date : pivotToTarget.date,
      };
    }
  }

  return null;
}

export function findDirectOrCrossRate(
  rates: WebExchangeRateItem[],
  fromCurrency: string,
  toCurrency: string
): string | null {
  return findDirectOrCrossRateWithDate(rates, fromCurrency, toCurrency)?.rate ?? null;
}

export function convertAmountViaRates(
  amount: string,
  fromCurrency: string,
  toCurrency: string,
  rates: WebExchangeRateItem[]
): { rate: string; converted: string; date: string | null } | null {
  const found = findDirectOrCrossRateWithDate(rates, fromCurrency, toCurrency);
  if (!found) return null;
  try {
    const converted = convertCurrency(amount || '0', found.rate);
    return { rate: found.rate, converted, date: found.date };
  } catch {
    return null;
  }
}

export function stripQuoteSuffix(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.(JK|NS|L|TO)$/i, '').replace(/-(USD|IDR|USDT|EUR)$/i, '');
}
