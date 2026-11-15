import { Decimal, toDecimal } from '@sure/shared';
import { parseIsoDate, prisma } from '../../../config/prisma.js';
import { AppError } from '../../../middleware/pipeline.js';
import { BalanceService } from '../../balances/balance.service.js';
import { StoredConnectionConfig } from '../sync.adapters.js';

export const DEFAULT_FX_TARGETS = ['IDR', 'USD', 'SGD', 'EUR', 'GBP', 'JPY', 'AUD', 'MYR'];

export interface ParsedFxRatePair {
  baseCurrency: string;
  targetCurrency: string;
  rate: string;
}

interface FrankfurterPayload {
  base?: string;
  date?: string;
  rates?: Record<string, number | string>;
}

/**
 * Normalizes Frankfurter API payload into direct and inverse Decimal(19, 8) exchange rates.
 */
export function parseFrankfurterRates(payload: unknown): {
  baseCurrency: string;
  rateDate: string;
  pairs: ParsedFxRatePair[];
} {
  const data = payload as FrankfurterPayload;
  if (!data || !data.base || !data.date || !data.rates || typeof data.rates !== 'object') {
    throw new Error('Invalid Frankfurter exchange rate response');
  }

  const base = data.base.trim().toUpperCase().slice(0, 3);
  const rateDate = data.date.slice(0, 10);
  const pairs: ParsedFxRatePair[] = [];

  for (const [rawTarget, rawRate] of Object.entries(data.rates)) {
    const target = rawTarget.trim().toUpperCase().slice(0, 3);
    if (!target || target === base || rawRate === undefined || rawRate === null) continue;

    const rateDec = toDecimal(String(rawRate));
    if (rateDec.lessThanOrEqualTo(0)) continue;

    pairs.push({
      baseCurrency: base,
      targetCurrency: target,
      rate: rateDec.toFixed(8, Decimal.ROUND_HALF_EVEN),
    });

    const inverse = new Decimal(1).dividedBy(rateDec);
    pairs.push({
      baseCurrency: target,
      targetCurrency: base,
      rate: inverse.toFixed(8, Decimal.ROUND_HALF_EVEN),
    });
  }

  return { baseCurrency: base, rateDate, pairs };
}

export async function syncFrankfurterConnection(params: {
  familyId: string;
  config: StoredConnectionConfig;
  fetchImpl?: typeof fetch;
}): Promise<{
  providerKey: 'frankfurter_fx';
  baseCurrency: string;
  rateDate: string;
  ratesUpdated: number;
  pairs: ParsedFxRatePair[];
  message: string;
}> {
  const fetchFn = params.fetchImpl ?? fetch;

  const family = await prisma.family.findUnique({
    where: { id: params.familyId },
    select: { baseCurrency: true },
  });

  const baseCurrency = (params.config.baseCurrency || family?.baseCurrency || 'IDR')
    .trim()
    .toUpperCase();
  const rawTargets =
    params.config.targetCurrencies && params.config.targetCurrencies.length > 0
      ? params.config.targetCurrencies
      : DEFAULT_FX_TARGETS;
  const targets = Array.from(
    new Set(
      rawTargets
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length === 3 && c !== baseCurrency)
    )
  );

  if (targets.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Select at least one target currency different from the base currency.'
    );
  }

  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(targets.join(','))}`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Frankfurter FX API error (HTTP ${res.status}) for base ${baseCurrency}`
    );
  }

  const payload = await res.json();
  const parsed = parseFrankfurterRates(payload);

  // When anchoring to a weaker base currency (e.g. IDR, JPY), Frankfurter formats small
  // forward decimals like 0.0000548 with limited significant digits. Refine pairs whose
  // forward rate is < 0.01 by querying from the stronger currency so inverse & cross rates
  // match historical chart precision exactly.
  const pairMap = new Map<string, ParsedFxRatePair>(
    parsed.pairs.map((p) => [`${p.baseCurrency}:${p.targetCurrency}`, p])
  );
  const weakForwardPairs = parsed.pairs.filter(
    (p) => p.baseCurrency === parsed.baseCurrency && toDecimal(p.rate).lessThan('0.01')
  );

  if (weakForwardPairs.length > 0) {
    await Promise.allSettled(
      weakForwardPairs.map(async (pair) => {
        const directUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(pair.targetCurrency)}&to=${encodeURIComponent(parsed.baseCurrency)}`;
        const directRes = await fetchFn(directUrl, { signal: AbortSignal.timeout(8000) });
        if (!directRes.ok) return;
        const directJson = (await directRes.json()) as FrankfurterPayload;
        const rawDirect = directJson?.rates?.[parsed.baseCurrency];
        if (rawDirect === undefined || rawDirect === null) return;
        const directDec = toDecimal(String(rawDirect));
        if (directDec.lessThanOrEqualTo(0)) return;

        pairMap.set(`${pair.targetCurrency}:${parsed.baseCurrency}`, {
          baseCurrency: pair.targetCurrency,
          targetCurrency: parsed.baseCurrency,
          rate: directDec.toFixed(8, Decimal.ROUND_HALF_EVEN),
        });
        pairMap.set(`${parsed.baseCurrency}:${pair.targetCurrency}`, {
          baseCurrency: parsed.baseCurrency,
          targetCurrency: pair.targetCurrency,
          rate: new Decimal(1).dividedBy(directDec).toFixed(8, Decimal.ROUND_HALF_EVEN),
        });
      })
    );
  }

  const finalPairs = Array.from(pairMap.values());
  const parsedDate = parseIsoDate(parsed.rateDate);
  const cutoffDate = parseIsoDate(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  for (const pair of finalPairs) {
    // Prune stale weekend/post-holiday rows newer than Frankfurter's authoritative rateDate
    // (up to today) so they never shadow the live business-day rate.
    if (parsedDate < cutoffDate) {
      await prisma.exchangeRate.deleteMany({
        where: {
          baseCurrency: pair.baseCurrency,
          targetCurrency: pair.targetCurrency,
          date: { gt: parsedDate, lte: cutoffDate },
        },
      });
    }

    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_targetCurrency_date: {
          baseCurrency: pair.baseCurrency,
          targetCurrency: pair.targetCurrency,
          date: parsedDate,
        },
      },
      update: { rate: pair.rate },
      create: {
        baseCurrency: pair.baseCurrency,
        targetCurrency: pair.targetCurrency,
        date: parsedDate,
        rate: pair.rate,
      },
    });
  }

  const foreignAccounts = await prisma.account.findMany({
    where: { familyId: params.familyId },
    select: { id: true, currency: true },
  });
  for (const acc of foreignAccounts) {
    if (acc.currency.toUpperCase() !== (family?.baseCurrency || baseCurrency).toUpperCase()) {
      await BalanceService.materializeAccount(params.familyId, acc.id);
    }
  }

  return {
    providerKey: 'frankfurter_fx',
    baseCurrency: parsed.baseCurrency,
    rateDate: parsed.rateDate,
    ratesUpdated: finalPairs.length,
    pairs: finalPairs,
    message: `Updated ${finalPairs.length} FX rate pair(s) anchored to ${parsed.baseCurrency} (${parsed.rateDate}).`,
  };
}
