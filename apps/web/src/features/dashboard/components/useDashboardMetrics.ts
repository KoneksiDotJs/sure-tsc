import { useMemo } from 'react';
import {
  addMoney,
  subMoney,
  absMoney,
  divMoney,
  mulMoney,
  compareMoney,
  isZeroMoney,
  formatCurrency,
} from '@sure/shared';
import type { SankeyFlowItem, DonutSlice, MonthlyBarDatum } from '@sure/ui';
import type {
  LedgerContextValue,
  WebAccount,
  WebCategory,
  WebEntry,
  WebReportData,
} from '../../../lib/ledger-context.js';

export type Timeframe = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

export interface OutflowCategoryRow {
  id: string;
  name: string;
  icon?: string;
  color: string;
  amount: string;
  numericValue: number;
  weightPercent: string;
}

export interface BalanceGroupRow {
  key: string;
  label: string;
  icon: string;
  classification: 'ASSET' | 'LIABILITY';
  color: string;
  total: string;
  weightPercent: string;
  accounts: WebAccount[];
}

export interface MixSegment {
  key: string;
  label: string;
  icon: string;
  color: string;
  weight: number;
}

interface UseDashboardMetricsParams {
  timeframe: Timeframe;
  baseCurrency: string;
  accounts: WebAccount[];
  categories: WebCategory[];
  entries: WebEntry[];
  summary: LedgerContextValue['summary'];
  reportData: WebReportData | null;
}

export function useDashboardMetrics({
  timeframe,
  baseCurrency,
  accounts,
  categories,
  entries,
  summary,
  reportData,
}: UseDashboardMetricsParams) {
  const { seriesPoints, deltaAmount, deltaPercent } = useMemo(() => {
    const rawHistory = reportData?.balanceSheet.netWorthHistory ?? [];
    const now = new Date();
    const cutoff = new Date(now);
    if (timeframe === '1M') cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
    else if (timeframe === '3M') cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
    else if (timeframe === '6M') cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
    else if (timeframe === 'YTD') cutoff.setUTCMonth(0, 1);
    else if (timeframe === '1Y') cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    else cutoff.setUTCFullYear(1970);

    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const filtered = rawHistory.filter((p) => p.date >= cutoffIso);
    const points = filtered.length > 0 ? filtered : rawHistory;

    if (points.length === 0) {
      const todayIso = now.toISOString().slice(0, 10);
      const curr = Number(summary.netWorth);
      return {
        seriesPoints: [
          { date: todayIso, value: curr },
          { date: todayIso, value: curr },
        ],
        deltaAmount: '0.0000',
        deltaPercent: '0.0',
      };
    }

    const first = points[0]!.netWorth;
    const last = points[points.length - 1]!.netWorth;
    const diff = subMoney(last, first);
    const absBase = absMoney(first);
    const pct =
      !isZeroMoney(absBase) && compareMoney(absBase, '0.0100') >= 0
        ? Number(divMoney(mulMoney(diff, '100.0000'), absBase)).toFixed(1)
        : '0.0';

    const mapped = points.map((p) => ({
      date: p.date,
      value: Number(p.netWorth),
    }));

    return {
      seriesPoints: mapped.length === 1 ? [mapped[0]!, mapped[0]!] : mapped,
      deltaAmount: diff,
      deltaPercent: pct,
    };
  }, [reportData, timeframe, summary.netWorth]);

  const { incomeNodes, outflowNodes, outflowCategories, totalOutflowAmount, totalInflowFormatted } =
    useMemo(() => {
      const catByName = new Map(categories.map((c) => [c.name, c]));

      const rawIncomes =
        reportData?.incomeStatement.incomeBreakdown &&
        reportData.incomeStatement.incomeBreakdown.length > 0
          ? reportData.incomeStatement.incomeBreakdown
          : (() => {
              const map = new Map<string, { name: string; color: string; amount: string }>();
              for (const e of entries) {
                if (e.entryType !== 'TRANSACTION' || e.excluded || e.splits.length > 0) continue;
                if (compareMoney(e.amount, '0.0000') > 0) {
                  const cat = categories.find((c) => c.id === e.categoryId);
                  const label = cat?.name ?? 'Income';
                  const prev = map.get(label) ?? {
                    name: label,
                    color: cat?.color ?? '#078C52',
                    amount: '0.0000',
                  };
                  prev.amount = addMoney(prev.amount, e.amount);
                  map.set(label, prev);
                }
              }
              return Array.from(map.values());
            })();

      const rawExpenses =
        reportData?.incomeStatement.expenseBreakdown &&
        reportData.incomeStatement.expenseBreakdown.length > 0
          ? reportData.incomeStatement.expenseBreakdown
          : (() => {
              const map = new Map<string, { name: string; color: string; amount: string }>();
              for (const e of entries) {
                if (e.entryType !== 'TRANSACTION' || e.excluded || e.splits.length > 0) continue;
                if (compareMoney(e.amount, '0.0000') < 0) {
                  const cat = categories.find((c) => c.id === e.categoryId);
                  const label = cat?.name ?? 'Uncategorized';
                  const prev = map.get(label) ?? {
                    name: label,
                    color: cat?.color ?? '#ef4444',
                    amount: '0.0000',
                  };
                  prev.amount = addMoney(prev.amount, absMoney(e.amount));
                  map.set(label, prev);
                }
              }
              return Array.from(map.values());
            })();

      const incItems: SankeyFlowItem[] = rawIncomes.map((inc) => ({
        name: inc.name,
        color: inc.color || '#078C52',
        amount: inc.amount,
        numericValue: Number(inc.amount),
        formattedAmount: formatCurrency(inc.amount, baseCurrency),
      }));

      let totalInc = '0.0000';
      for (const i of rawIncomes) totalInc = addMoney(totalInc, i.amount);

      let totalOut = '0.0000';
      for (const e of rawExpenses) totalOut = addMoney(totalOut, e.amount);

      const expItems: SankeyFlowItem[] = rawExpenses.map((exp) => ({
        name: exp.name,
        color: exp.color || '#ef4444',
        amount: exp.amount,
        numericValue: Number(exp.amount),
        formattedAmount: formatCurrency(exp.amount, baseCurrency),
      }));

      const surplus = subMoney(totalInc, totalOut);
      if (compareMoney(surplus, '0.0000') > 0) {
        expItems.push({
          name: 'Surplus',
          color: '#078C52',
          amount: surplus,
          numericValue: Number(surplus),
          formattedAmount: formatCurrency(surplus, baseCurrency),
        });
      }

      const sortedExpenses = [...rawExpenses].sort((a, b) => compareMoney(b.amount, a.amount));
      const catRows: OutflowCategoryRow[] = sortedExpenses.map((exp) => {
        const matched = catByName.get(exp.name);
        const weight =
          !isZeroMoney(totalOut) && compareMoney(totalOut, '0.0000') > 0
            ? Number(divMoney(mulMoney(exp.amount, '100.0000'), totalOut)).toFixed(1)
            : '0.0';
        return {
          id: matched?.id ?? exp.name,
          name: exp.name,
          icon: matched?.icon,
          color: exp.color || matched?.color || '#3b82f6',
          amount: exp.amount,
          numericValue: Number(exp.amount),
          weightPercent: weight,
        };
      });

      return {
        incomeNodes: incItems,
        outflowNodes: expItems,
        outflowCategories: catRows,
        totalOutflowAmount: totalOut,
        totalInflowFormatted: formatCurrency(totalInc, baseCurrency),
      };
    }, [reportData, entries, categories, baseCurrency]);

  const donutSlices: DonutSlice[] = useMemo(
    () =>
      outflowCategories.map((c) => ({
        id: c.id,
        label: c.name,
        color: c.color,
        value: c.numericValue,
        weightPercent: c.weightPercent,
      })),
    [outflowCategories]
  );

  const { monthlyBars, latestMonthTotals } = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }

    const bucketMap = new Map<string, { inc: string; exp: string }>();
    for (const m of months) bucketMap.set(m, { inc: '0.0000', exp: '0.0000' });

    for (const e of entries) {
      if (e.entryType !== 'TRANSACTION' || e.excluded || e.splits.length > 0) continue;
      const key = e.date.slice(0, 7);
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      if (compareMoney(e.amount, '0.0000') >= 0) {
        bucket.inc = addMoney(bucket.inc, e.amount);
      } else {
        bucket.exp = addMoney(bucket.exp, absMoney(e.amount));
      }
    }

    const bars: MonthlyBarDatum[] = months.map((m) => {
      const b = bucketMap.get(m) ?? { inc: '0.0000', exp: '0.0000' };
      const labelDate = new Date(`${m}-01T00:00:00Z`);
      const label = labelDate.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return {
        monthKey: m,
        label,
        income: Number(b.inc),
        expenses: Number(b.exp),
        incomeFormatted: formatCurrency(b.inc, baseCurrency),
        expensesFormatted: formatCurrency(b.exp, baseCurrency),
      };
    });

    const latestKey = months[months.length - 1] ?? '';
    const latest = bucketMap.get(latestKey) ?? { inc: '0.0000', exp: '0.0000' };
    return {
      monthlyBars: bars,
      latestMonthTotals: {
        income: latest.inc,
        expenses: latest.exp,
        net: subMoney(latest.inc, latest.exp),
      },
    };
  }, [entries, baseCurrency]);

  const spendingPace = useMemo(() => {
    const now = new Date();
    const currMonth = now.toISOString().slice(0, 7);
    const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevMonth = prevDate.toISOString().slice(0, 7);
    const maxDay = Math.max(1, now.getUTCDate());

    const currByDay = new Array<string>(32).fill('0.0000');
    const prevByDay = new Array<string>(32).fill('0.0000');

    for (const e of entries) {
      if (e.entryType !== 'TRANSACTION' || e.excluded || e.splits.length > 0) continue;
      if (compareMoney(e.amount, '0.0000') >= 0) continue;
      const ym = e.date.slice(0, 7);
      const day = Math.min(31, Math.max(1, Number(e.date.slice(8, 10)) || 1));
      const amt = absMoney(e.amount);
      if (ym === currMonth) currByDay[day] = addMoney(currByDay[day]!, amt);
      else if (ym === prevMonth) prevByDay[day] = addMoney(prevByDay[day]!, amt);
    }

    let cumCurr = '0.0000';
    let cumPrev = '0.0000';
    const pts: Array<{ date: string; value: number; comparisonValue: number }> = [];
    for (let d = 1; d <= maxDay; d++) {
      cumCurr = addMoney(cumCurr, currByDay[d]!);
      cumPrev = addMoney(cumPrev, prevByDay[d]!);
      pts.push({
        date: `${currMonth}-${String(d).padStart(2, '0')}`,
        value: Number(cumCurr),
        comparisonValue: Number(cumPrev),
      });
    }

    return {
      currentTotal: cumCurr,
      priorTotal: cumPrev,
      delta: subMoney(cumCurr, cumPrev),
      points: pts.length === 1 ? [pts[0]!, pts[0]!] : pts,
    };
  }, [entries]);

  const { assetGroups, liabilityGroups, mixSegments } = useMemo(() => {
    const specs: Array<{
      key: string;
      label: string;
      icon: string;
      classification: 'ASSET' | 'LIABILITY';
      color: string;
      types: string[];
    }> = [
      { key: 'DEPOSITORY', label: 'Cash & Checking', icon: 'Wallet', classification: 'ASSET', color: '#078C52', types: ['DEPOSITORY'] },
      { key: 'INVESTMENT', label: 'Investments & Crypto', icon: 'TrendingUp', classification: 'ASSET', color: '#3b82f6', types: ['INVESTMENT', 'CRYPTO'] },
      { key: 'PROPERTY', label: 'Property & Vehicles', icon: 'Home', classification: 'ASSET', color: '#8b5cf6', types: ['PROPERTY', 'VEHICLE', 'OTHER_ASSET'] },
      { key: 'CREDIT_CARD', label: 'Credit Cards', icon: 'CreditCard', classification: 'LIABILITY', color: '#f97316', types: ['CREDIT_CARD'] },
      { key: 'LOAN', label: 'Loans & Mortgages', icon: 'Landmark', classification: 'LIABILITY', color: '#ef4444', types: ['LOAN', 'OTHER_LIABILITY'] },
    ];

    const calcWeight = (part: string, whole: string): string => {
      if (isZeroMoney(whole) || compareMoney(whole, '0.0000') === 0) return '0.0';
      return Number(divMoney(mulMoney(part, '100.0000'), whole)).toFixed(1);
    };

    const aGroups: BalanceGroupRow[] = [];
    const lGroups: BalanceGroupRow[] = [];

    for (const s of specs) {
      const matching = accounts.filter(
        (acc) => acc.classification === s.classification && s.types.includes(acc.accountType)
      );
      if (matching.length === 0) continue;
      let total = '0.0000';
      for (const acc of matching) total = addMoney(total, acc.balance);
      const denom = s.classification === 'ASSET' ? summary.totalAssets : summary.totalLiabilities;
      const row: BalanceGroupRow = {
        key: s.key,
        label: s.label,
        icon: s.icon,
        classification: s.classification,
        color: s.color,
        total,
        weightPercent: calcWeight(total, denom),
        accounts: matching,
      };
      if (s.classification === 'ASSET') aGroups.push(row);
      else lGroups.push(row);
    }

    const grossPool = addMoney(summary.totalAssets, summary.totalLiabilities);
    const segments: MixSegment[] = [...aGroups, ...lGroups].map((g) => ({
      key: g.key,
      label: g.label,
      icon: g.icon,
      color: g.color,
      weight: Number(calcWeight(g.total, grossPool)),
    }));

    return { assetGroups: aGroups, liabilityGroups: lGroups, mixSegments: segments };
  }, [accounts, summary.totalAssets, summary.totalLiabilities]);

  const savingsRateLabel = reportData?.incomeStatement.savingsRatePercent
    ? `Savings Rate ${Number(reportData.incomeStatement.savingsRatePercent).toFixed(0)}%`
    : 'Cash Flow';

  return {
    seriesPoints,
    deltaAmount,
    deltaPercent,
    incomeNodes,
    outflowNodes,
    outflowCategories,
    totalOutflowAmount,
    totalInflowFormatted,
    donutSlices,
    monthlyBars,
    latestMonthTotals,
    spendingPace,
    assetGroups,
    liabilityGroups,
    mixSegments,
    savingsRateLabel,
  };
}
