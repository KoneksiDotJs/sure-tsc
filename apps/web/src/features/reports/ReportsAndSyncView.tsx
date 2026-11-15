import React, { useEffect, useMemo, useState } from 'react';
import {
  addMoney,
  subMoney,
  absMoney,
  compareMoney,
  divMoney,
  mulMoney,
  isZeroMoney,
  formatCurrency,
} from '@sure/shared';
import {
  Card,
  Section,
  MoneyAmount,
  Pill,
  Button,
  DetailRow,
  Alert,
  Dialog,
  SegmentedControl,
  CategoryIcon,
  CashflowSankeyChart,
  ResponsiveAreaChart,
} from '@sure/ui';
import { useLedger, WebAccountHolding } from '../../lib/ledger-context.js';
import {
  Check,
  RefreshCw,
  Plus,
  Plug,
  Printer,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Gauge,
  Briefcase,
  BarChart2,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';

import { InvestmentReportCard } from './components/InvestmentReportCard';
import { SyncConnectionsAndConflicts } from './components/SyncConnectionsAndConflicts';

type ReportPeriodMode = 'MONTHLY' | 'QUARTERLY' | 'YTD' | 'LAST_6M' | 'CUSTOM';

interface CategoryActivityRow {
  id: string;
  name: string;
  icon?: string;
  color: string;
  count: number;
  amount: string;
  percentOfTotal: string;
}

function getMonthBounds(anchorDate: Date): { start: string; end: string; label: string } {
  const y = anchorDate.getUTCFullYear();
  const m = anchorDate.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { start, end, label };
}

function getQuarterBounds(anchorDate: Date): { start: string; end: string; label: string } {
  const y = anchorDate.getUTCFullYear();
  const q = Math.floor(anchorDate.getUTCMonth() / 3);
  const startMonth = q * 3;
  const start = new Date(Date.UTC(y, startMonth, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, startMonth + 3, 0)).toISOString().slice(0, 10);
  return { start, end, label: `Q${q + 1} ${y}` };
}

export const ReportsAndSyncView: React.FC = () => {
  const {
    family,
    accounts,
    entries,
    categories,
    summary,
    reportData,
    budgetRows,
    conflicts,
    syncAdapters,
    syncConnections,
    connectProvider,
    deleteProviderConnection,
    runSyncAll,
    resolveConflict,
    fetchAccountHoldings,
  } = useLedger();

  // Period controls state
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('MONTHLY');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Collapsible section states (matching Sure Reports sections)
  const [trendsOpen, setTrendsOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [netWorthOpen, setNetWorthOpen] = useState(true);
  const [investmentOpen, setInvestmentOpen] = useState(true);
  const [showSankeyInTrends, setShowSankeyInTrends] = useState(true);
  const [showHoldingDetails, setShowHoldingDetails] = useState(false);

  // Sync / Provider states
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedAdapterKey, setSelectedAdapterKey] = useState('plaid');
  const [institutionName, setInstitutionName] = useState('');

  // Aggregated Holdings across all investment/crypto accounts
  const [allHoldings, setAllHoldings] = useState<WebAccountHolding[]>([]);

  const investmentAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'INVESTMENT' || a.accountType === 'CRYPTO'),
    [accounts]
  );

  useEffect(() => {
    let cancelled = false;
    if (investmentAccounts.length === 0) {
      setAllHoldings([]);
      return;
    }
    Promise.all(investmentAccounts.map((acc) => fetchAccountHoldings(acc.id).catch(() => null)))
      .then((results) => {
        if (cancelled) return;
        const merged: WebAccountHolding[] = [];
        for (const r of results) {
          if (r?.holdings) merged.push(...r.holdings);
        }
        setAllHoldings(merged);
      })
      .catch(() => {
        if (!cancelled) setAllHoldings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [investmentAccounts, fetchAccountHoldings]);

  // Active & Prior date windows
  const { startDate, endDate, periodLabel, prevStartDate, prevEndDate } = useMemo(() => {
    if (periodMode === 'CUSTOM') {
      const s = customStart <= customEnd ? customStart : customEnd;
      const e = customStart <= customEnd ? customEnd : customStart;
      const diffMs = new Date(`${e}T00:00:00Z`).getTime() - new Date(`${s}T00:00:00Z`).getTime();
      const prevEnd = new Date(new Date(`${s}T00:00:00Z`).getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - diffMs);
      return {
        startDate: s,
        endDate: e,
        periodLabel: `${s} → ${e}`,
        prevStartDate: prevStart.toISOString().slice(0, 10),
        prevEndDate: prevEnd.toISOString().slice(0, 10),
      };
    }

    if (periodMode === 'QUARTERLY') {
      const curr = getQuarterBounds(anchorDate);
      const prevAnchor = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - 3, 1));
      const prev = getQuarterBounds(prevAnchor);
      return {
        startDate: curr.start,
        endDate: curr.end,
        periodLabel: curr.label,
        prevStartDate: prev.start,
        prevEndDate: prev.end,
      };
    }

    if (periodMode === 'YTD') {
      const y = anchorDate.getUTCFullYear();
      const start = `${y}-01-01`;
      const end = new Date(Date.UTC(y, anchorDate.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const prevStart = `${y - 1}-01-01`;
      const prevEnd = `${y - 1}-${end.slice(5)}`;
      return {
        startDate: start,
        endDate: end,
        periodLabel: `YTD ${y}`,
        prevStartDate: prevStart,
        prevEndDate: prevEnd,
      };
    }

    if (periodMode === 'LAST_6M') {
      const end = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
      const start = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - 5, 1))
        .toISOString()
        .slice(0, 10);
      const prevEnd = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - 5, 0))
        .toISOString()
        .slice(0, 10);
      const prevStart = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - 11, 1))
        .toISOString()
        .slice(0, 10);
      return {
        startDate: start,
        endDate: end,
        periodLabel: 'Last 6 Months',
        prevStartDate: prevStart,
        prevEndDate: prevEnd,
      };
    }

    const curr = getMonthBounds(anchorDate);
    const prevAnchor = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - 1, 1));
    const prev = getMonthBounds(prevAnchor);
    return {
      startDate: curr.start,
      endDate: curr.end,
      periodLabel: curr.label,
      prevStartDate: prev.start,
      prevEndDate: prev.end,
    };
  }, [periodMode, anchorDate, customStart, customEnd]);

  const stepPeriod = (dir: -1 | 1) => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (periodMode === 'QUARTERLY') next.setUTCMonth(next.getUTCMonth() + dir * 3);
      else if (periodMode === 'YTD') next.setUTCFullYear(next.getUTCFullYear() + dir);
      else next.setUTCMonth(next.getUTCMonth() + dir);
      return next;
    });
  };

  // Period Leaf Entries Filtering (Honors Invariant #3: leaf-only split attribution + excluded exclusion)
  const {
    periodIncome,
    periodExpenses,
    periodNetSavings,
    incomeDeltaPct,
    expenseDeltaPct,
    budgetUsedPct,
    incomeRows,
    expenseRows,
  } = useMemo(() => {
    const calcWindow = (sDate: string, eDate: string) => {
      let inc = '0.0000';
      let exp = '0.0000';
      const incMap = new Map<string, CategoryActivityRow>();
      const expMap = new Map<string, CategoryActivityRow>();

      const pushCat = (
        map: Map<string, CategoryActivityRow>,
        catId: string | null,
        amt: string
      ) => {
        const cat = categories.find((c) => c.id === catId);
        const key = cat?.id ?? '__uncategorized__';
        const prev = map.get(key) ?? {
          id: key,
          name: cat?.name ?? 'Uncategorized',
          icon: cat?.icon,
          color: cat?.color ?? '#6b7280',
          count: 0,
          amount: '0.0000',
          percentOfTotal: '0.0',
        };
        prev.count += 1;
        prev.amount = addMoney(prev.amount, amt);
        map.set(key, prev);
      };

      for (const e of entries) {
        if (e.entryType !== 'TRANSACTION' || e.excluded) continue;
        if (e.date < sDate || e.date > eDate) continue;

        if (e.splits && e.splits.length > 0) {
          for (const sp of e.splits) {
            if (compareMoney(sp.amount, '0.0000') >= 0) {
              inc = addMoney(inc, sp.amount);
              pushCat(incMap, sp.categoryId, sp.amount);
            } else {
              const absVal = absMoney(sp.amount);
              exp = addMoney(exp, absVal);
              pushCat(expMap, sp.categoryId, absVal);
            }
          }
          continue;
        }

        if (compareMoney(e.amount, '0.0000') >= 0) {
          inc = addMoney(inc, e.amount);
          pushCat(incMap, e.categoryId, e.amount);
        } else {
          const absVal = absMoney(e.amount);
          exp = addMoney(exp, absVal);
          pushCat(expMap, e.categoryId, absVal);
        }
      }

      return { inc, exp, incMap, expMap };
    };

    const curr = calcWindow(startDate, endDate);
    const prev = calcWindow(prevStartDate, prevEndDate);

    const calcPctDelta = (cVal: string, pVal: string): number | null => {
      if (isZeroMoney(pVal) || compareMoney(pVal, '0.0100') < 0) return null;
      return Number(divMoney(mulMoney(subMoney(cVal, pVal), '100.0000'), absMoney(pVal)));
    };

    const finalizeRows = (map: Map<string, CategoryActivityRow>, total: string) =>
      Array.from(map.values())
        .sort((a, b) => compareMoney(b.amount, a.amount))
        .map((row) => ({
          ...row,
          percentOfTotal:
            !isZeroMoney(total) && compareMoney(total, '0.0000') > 0
              ? Number(divMoney(mulMoney(row.amount, '100.0000'), total)).toFixed(1)
              : '0.0',
        }));

    let totalBudgeted = '0.0000';
    for (const b of budgetRows) {
      totalBudgeted = addMoney(totalBudgeted, b.effectiveAvailable);
    }
    const bPct =
      !isZeroMoney(totalBudgeted) && compareMoney(totalBudgeted, '0.0000') > 0
        ? Number(divMoney(mulMoney(curr.exp, '100.0000'), totalBudgeted))
        : 0;

    return {
      periodIncome: curr.inc,
      periodExpenses: curr.exp,
      periodNetSavings: subMoney(curr.inc, curr.exp),
      incomeDeltaPct: calcPctDelta(curr.inc, prev.inc),
      expenseDeltaPct: calcPctDelta(curr.exp, prev.exp),
      budgetUsedPct: Math.min(999, Math.max(0, bPct)),
      incomeRows: finalizeRows(curr.incMap, curr.inc),
      expenseRows: finalizeRows(curr.expMap, curr.exp),
    };
  }, [entries, categories, startDate, endDate, prevStartDate, prevEndDate, budgetRows]);

  // Trends & Insights Monthly Breakdown
  const { monthlyBreakdown, avgMonthly } = useMemo(() => {
    const startYm = startDate.slice(0, 7);
    const endYm = endDate.slice(0, 7);
    const months = new Map<string, { inc: string; exp: string }>();

    let cursor = new Date(`${startYm}-01T00:00:00Z`);
    const endCursor = new Date(`${endYm}-01T00:00:00Z`);
    let guard = 0;
    while (cursor <= endCursor && guard < 24) {
      months.set(cursor.toISOString().slice(0, 7), { inc: '0.0000', exp: '0.0000' });
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      guard += 1;
    }

    for (const e of entries) {
      if (e.entryType !== 'TRANSACTION' || e.excluded || e.splits.length > 0) continue;
      if (e.date < startDate || e.date > endDate) continue;
      const ym = e.date.slice(0, 7);
      const b = months.get(ym);
      if (!b) continue;
      if (compareMoney(e.amount, '0.0000') >= 0) b.inc = addMoney(b.inc, e.amount);
      else b.exp = addMoney(b.exp, absMoney(e.amount));
    }

    const currentYm = new Date().toISOString().slice(0, 7);
    const rows = Array.from(months.entries()).map(([ym, vals]) => {
      const net = subMoney(vals.inc, vals.exp);
      const rate =
        !isZeroMoney(vals.inc) && compareMoney(vals.inc, '0.0000') > 0
          ? Number(divMoney(mulMoney(net, '100.0000'), vals.inc)).toFixed(1)
          : '0.0';
      const label = new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return {
        ym,
        label,
        isCurrent: ym === currentYm,
        income: vals.inc,
        expenses: vals.exp,
        net,
        savingsRate: rate,
      };
    });

    const countStr = `${Math.max(1, rows.length)}.0000`;
    let sumInc = '0.0000';
    let sumExp = '0.0000';
    for (const r of rows) {
      sumInc = addMoney(sumInc, r.income);
      sumExp = addMoney(sumExp, r.expenses);
    }
    const avgInc = divMoney(sumInc, countStr);
    const avgExp = divMoney(sumExp, countStr);
    return {
      monthlyBreakdown: rows,
      avgMonthly: {
        income: avgInc,
        expenses: avgExp,
        savings: subMoney(avgInc, avgExp),
      },
    };
  }, [entries, startDate, endDate]);

  // Net Worth section series & asset/liability group breakdown
  const { nwSeries, nwDelta, nwDeltaPct, assetSummaryGroups, liabilitySummaryGroups } = useMemo(() => {
    const rawHistory = reportData?.balanceSheet.netWorthHistory ?? [];
    const filtered = rawHistory.filter((p) => p.date >= startDate && p.date <= endDate);
    const pts = filtered.length > 0 ? filtered : rawHistory;

    const first = pts[0]?.netWorth ?? summary.netWorth;
    const last = pts[pts.length - 1]?.netWorth ?? summary.netWorth;
    const diff = subMoney(last, first);
    const absFirst = absMoney(first);
    const pct =
      !isZeroMoney(absFirst) && compareMoney(absFirst, '0.0100') >= 0
        ? Number(divMoney(mulMoney(diff, '100.0000'), absFirst)).toFixed(1)
        : '0.0';

    const series =
      pts.length > 0
        ? pts.map((p) => ({ date: p.date, value: Number(p.netWorth) }))
        : [{ date: startDate, value: Number(summary.netWorth) }];

    const groupDefs: Array<{
      label: string;
      icon: string;
      color: string;
      classification: 'ASSET' | 'LIABILITY';
      types: string[];
    }> = [
      { label: 'Cash', icon: 'Wallet', color: '#078C52', classification: 'ASSET', types: ['DEPOSITORY'] },
      { label: 'Investments', icon: 'TrendingUp', color: '#3b82f6', classification: 'ASSET', types: ['INVESTMENT'] },
      { label: 'Crypto', icon: 'Coins', color: '#f59e0b', classification: 'ASSET', types: ['CRYPTO'] },
      { label: 'Properties', icon: 'Home', color: '#8b5cf6', classification: 'ASSET', types: ['PROPERTY'] },
      { label: 'Vehicles', icon: 'Car', color: '#14b8a6', classification: 'ASSET', types: ['VEHICLE'] },
      { label: 'Other Assets', icon: 'Package', color: '#6b7280', classification: 'ASSET', types: ['OTHER_ASSET'] },
      { label: 'Credit Cards', icon: 'CreditCard', color: '#f97316', classification: 'LIABILITY', types: ['CREDIT_CARD'] },
      { label: 'Loans', icon: 'Landmark', color: '#ef4444', classification: 'LIABILITY', types: ['LOAN'] },
      { label: 'Other Liabilities', icon: 'Shapes', color: '#64748b', classification: 'LIABILITY', types: ['OTHER_LIABILITY'] },
    ];

    const calcGroups = (cls: 'ASSET' | 'LIABILITY') =>
      groupDefs
        .filter((d) => d.classification === cls)
        .map((d) => {
          const matching = accounts.filter(
            (a) => a.classification === cls && d.types.includes(a.accountType)
          );
          let total = '0.0000';
          for (const a of matching) total = addMoney(total, a.balance);
          return { ...d, total, count: matching.length };
        })
        .filter((g) => g.count > 0 || !isZeroMoney(g.total));

    return {
      nwSeries: series,
      nwDelta: diff,
      nwDeltaPct: pct,
      assetSummaryGroups: calcGroups('ASSET'),
      liabilitySummaryGroups: calcGroups('LIABILITY'),
    };
  }, [reportData, startDate, endDate, summary.netWorth, accounts]);

  // Investment Performance calculations
  const investmentPerf = useMemo(() => {
    let holdingsMarket = '0.0000';
    let holdingsCost = '0.0000';
    let unrealized = '0.0000';

    for (const h of allHoldings) {
      holdingsMarket = addMoney(holdingsMarket, h.marketValue);
      holdingsCost = addMoney(holdingsCost, h.costBasisTotal);
      unrealized = addMoney(unrealized, h.unrealizedGain);
    }

    let accTotal = '0.0000';
    for (const acc of investmentAccounts) accTotal = addMoney(accTotal, acc.balance);

    const portfolioValue = compareMoney(holdingsMarket, '0.0000') > 0 ? holdingsMarket : accTotal;
    const totalReturnPct =
      !isZeroMoney(holdingsCost) && compareMoney(holdingsCost, '0.0000') > 0
        ? Number(divMoney(mulMoney(unrealized, '100.0000'), holdingsCost)).toFixed(1)
        : '0.0';

    let contributions = '0.0000';
    let withdrawals = '0.0000';
    let realizedGains = '0.0000';
    const invAccountIds = new Set(investmentAccounts.map((a) => a.id));

    for (const e of entries) {
      if (e.date < startDate || e.date > endDate) continue;
      if (!invAccountIds.has(e.accountId)) continue;
      if (e.entryType === 'TRADE' && e.tradeDetails) {
        if (e.tradeDetails.tradeAction === 'BUY') {
          contributions = addMoney(contributions, absMoney(e.amount));
        } else if (e.tradeDetails.tradeAction === 'SELL') {
          withdrawals = addMoney(withdrawals, absMoney(e.amount));
        } else if (e.tradeDetails.tradeAction === 'DIVIDEND') {
          realizedGains = addMoney(realizedGains, absMoney(e.amount));
        }
      } else if (e.entryType === 'TRANSACTION') {
        if (compareMoney(e.amount, '0.0000') > 0) contributions = addMoney(contributions, e.amount);
        else withdrawals = addMoney(withdrawals, absMoney(e.amount));
      }
    }

    const sortedHoldings = [...allHoldings]
      .sort((a, b) => compareMoney(b.marketValue, a.marketValue))
      .map((h) => ({
        ...h,
        weightPct:
          !isZeroMoney(portfolioValue) && compareMoney(portfolioValue, '0.0000') > 0
            ? Number(divMoney(mulMoney(h.marketValue, '100.0000'), portfolioValue)).toFixed(1)
            : '0.0',
      }));

    return {
      portfolioValue,
      unrealized,
      totalReturnPct,
      contributions,
      withdrawals,
      realizedGains,
      topHoldings: sortedHoldings,
    };
  }, [allHoldings, investmentAccounts, entries, startDate, endDate]);

  const handleExportActivityCsv = () => {
    const csvEscape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const lines = [
      ['Type', 'Category', 'Entries', 'Amount', 'PercentOfTotal', 'Currency'].join(','),
      ...incomeRows.map((r) =>
        ['Income', csvEscape(r.name), String(r.count), r.amount, `${r.percentOfTotal}%`, family.baseCurrency].join(',')
      ),
      ...expenseRows.map((r) =>
        ['Expense', csvEscape(r.name), String(r.count), r.amount, `${r.percentOfTotal}%`, family.baseCurrency].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sure-report-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sankeyRightNodes = useMemo(() => {
    const list = expenseRows.map((ef) => ({
      name: ef.name,
      color: ef.color,
      amount: ef.amount,
    }));
    if (compareMoney(periodNetSavings, '0.0000') > 0) {
      list.unshift({
        name: 'Surplus',
        color: '#078C52',
        amount: periodNetSavings,
      });
    }
    return list;
  }, [expenseRows, periodNetSavings]);

  const adapterCategories = useMemo(() => {
    const groups: Record<string, typeof syncAdapters> = {
      BANKING: [],
      CRYPTO: [],
      BROKERAGE: [],
      MARKET_DATA: [],
    };
    for (const a of syncAdapters) groups[a.category]?.push(a);
    return groups;
  }, [syncAdapters]);

  const handleSyncAll = async () => {
    const res = await runSyncAll();
    setSyncBanner(
      `Synchronized ${res.syncedConnections} provider connection(s) and materialized daily balances for ${res.materializedAccounts} account(s).`
    );
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const adapter = syncAdapters.find((a) => a.key === selectedAdapterKey);
    await connectProvider({
      providerKey: selectedAdapterKey,
      institutionName: institutionName.trim() || adapter?.name || selectedAdapterKey,
    });
    setInstitutionName('');
    setConnectOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Printable Tufte Financial Report (hidden on screen, active on window.print()) */}
      <div className="print-only print-body">
        <div className="print-container tufte-report">
          <div className="tufte-header">
            <h1 className="tufte-title">{family.name} — Financial Statement</h1>
            <span className="tufte-period">
              {periodLabel} ({startDate} to {endDate} • {family.baseCurrency})
            </span>
          </div>
          <div className="tufte-section">
            <h2 className="tufte-section-title">Balance Sheet &amp; Cash Flow Summary</h2>
            <div className="tufte-metric-row">
              <div className="tufte-metric-card">
                <span className="tufte-metric-card-label">Net Worth</span>
                <span className="tufte-metric-card-value">{summary.netWorth}</span>
              </div>
              <div className="tufte-metric-card">
                <span className="tufte-metric-card-label">Period Income</span>
                <span className="tufte-metric-card-value tufte-income">{periodIncome}</span>
              </div>
              <div className="tufte-metric-card">
                <span className="tufte-metric-card-label">Period Expenses</span>
                <span className="tufte-metric-card-value tufte-expense">{periodExpenses}</span>
              </div>
            </div>
          </div>
          <div className="tufte-section">
            <h2 className="tufte-section-title">Expense Breakdown</h2>
            <table className="tufte-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="tufte-right">Amount ({family.baseCurrency})</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((ef) => (
                  <tr key={ef.id}>
                    <td>
                      <span className="tufte-dot" style={{ backgroundColor: ef.color }} />
                      {ef.name}
                    </td>
                    <td className="tufte-right">{ef.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tufte-footer">
            Generated by Sure Wealth &amp; Ledger OS • Fixed-Point Decimal(19,4)
          </div>
        </div>
      </div>

      {/* 1. Reports Header & Period Picker (Screenshot #1) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Reports
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Comprehensive insights into your financial health
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="no-print"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => window.print()}
          >
            Print Report
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl<ReportPeriodMode>
            options={[
              { value: 'MONTHLY', label: 'Monthly' },
              { value: 'QUARTERLY', label: 'Quarterly' },
              { value: 'YTD', label: 'Year to Date' },
              { value: 'LAST_6M', label: 'Last 6 Months' },
              { value: 'CUSTOM', label: 'Custom Range' },
            ]}
            value={periodMode}
            onChange={setPeriodMode}
            size="sm"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {periodMode !== 'CUSTOM' && (
              <>
                <button
                  type="button"
                  onClick={() => stepPeriod(-1)}
                  aria-label="Previous period"
                  className="p-1.5 rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => stepPeriod(1)}
                  aria-label="Next period"
                  className="p-1.5 rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-base font-medium text-[var(--text-primary)] ml-1">
                  {periodLabel}
                </span>
              </>
            )}
            {periodMode === 'CUSTOM' && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)] font-mono-tabular"
                />
                <span className="text-[var(--text-secondary)]">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)] font-mono-tabular"
                />
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAnchorDate(new Date());
              setPeriodMode('MONTHLY');
            }}
          >
            Today
          </Button>
        </div>

        {/* Top 4 KPI Cards (Total Income, Total Expenses, Net Savings, Budget Performance) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card padding="sm">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Total Income</span>
            </div>
            <div className="mt-2 text-2xl font-semibold font-mono-tabular">
              <MoneyAmount value={periodIncome} currency={family.baseCurrency} />
            </div>
            <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
              {incomeDeltaPct === null ? (
                <span>For {periodLabel}</span>
              ) : (
                <span
                  className={
                    incomeDeltaPct >= 0
                      ? 'text-[var(--status-positive)]'
                      : 'text-[var(--status-negative)]'
                  }
                >
                  {incomeDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(incomeDeltaPct).toFixed(1)}% vs
                  previous period
                </span>
              )}
            </div>
          </Card>

          <Card padding="sm">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Total Expenses</span>
            </div>
            <div className="mt-2 text-2xl font-semibold font-mono-tabular">
              <MoneyAmount value={periodExpenses} currency={family.baseCurrency} />
            </div>
            <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
              {expenseDeltaPct === null ? (
                <span>For {periodLabel}</span>
              ) : (
                <span
                  className={
                    expenseDeltaPct <= 0
                      ? 'text-[var(--status-positive)]'
                      : 'text-[var(--status-negative)]'
                  }
                >
                  {expenseDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(expenseDeltaPct).toFixed(1)}% vs
                  previous period
                </span>
              )}
            </div>
          </Card>

          <Card padding="sm">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Net Savings</span>
            </div>
            <div className="mt-2 text-2xl font-semibold font-mono-tabular">
              <MoneyAmount
                value={periodNetSavings}
                currency={family.baseCurrency}
                colorize
                showSign
              />
            </div>
            <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
              Income minus expenses
            </div>
          </Card>

          <Card padding="sm">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Gauge className="w-3.5 h-3.5" />
              <span>Budget Performance</span>
            </div>
            <div className="mt-2 text-2xl font-semibold font-mono-tabular">
              {budgetUsedPct.toFixed(0)}%
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, budgetUsedPct)}%`,
                  backgroundColor: budgetUsedPct > 100 ? '#ef4444' : '#078C52',
                }}
              />
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">of budget used</div>
          </Card>
        </div>
      </div>

      {/* Section 1: Trends & Insights (Screenshot #1) */}
      <Card padding="none">
        <div className="px-5 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setTrendsOpen((v) => !v)}
            className="flex items-center gap-2 text-left cursor-pointer"
          >
            {trendsOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Trends &amp; Insights
            </span>
          </button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSankeyInTrends((v) => !v)}
          >
            {showSankeyInTrends ? 'Hide Cashflow Sankey' : 'Show Cashflow Sankey'}
          </Button>
        </div>

        {trendsOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-[var(--border-primary)] space-y-5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
                Monthly Breakdown
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
                  <div className="col-span-4">Month</div>
                  <div className="col-span-2 text-right">Income</div>
                  <div className="col-span-2 text-right">Expenses</div>
                  <div className="col-span-2 text-right">Net</div>
                  <div className="col-span-2 text-right">Savings Rate</div>
                </div>
                <div className="divide-y divide-[var(--border-primary)]">
                  {monthlyBreakdown.map((m) => (
                    <div
                      key={m.ym}
                      className="grid grid-cols-12 items-center px-4 py-2.5 text-xs bg-[var(--bg-surface)]"
                    >
                      <div className="col-span-4 font-medium text-[var(--text-primary)]">
                        {m.label}{' '}
                        {m.isCurrent && (
                          <span className="text-[var(--text-muted)]">(current)</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right font-mono-tabular">
                        <MoneyAmount value={m.income} currency={family.baseCurrency} />
                      </div>
                      <div className="col-span-2 text-right font-mono-tabular">
                        <MoneyAmount value={m.expenses} currency={family.baseCurrency} />
                      </div>
                      <div className="col-span-2 text-right font-mono-tabular">
                        <MoneyAmount
                          value={m.net}
                          currency={family.baseCurrency}
                          colorize
                          showSign
                        />
                      </div>
                      <div
                        className={`col-span-2 text-right font-mono-tabular font-medium ${
                          Number(m.savingsRate) >= 0
                            ? 'text-[var(--status-positive)]'
                            : 'text-[var(--status-negative)]'
                        }`}
                      >
                        {m.savingsRate}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <div className="text-xs text-[var(--text-secondary)]">Avg. Monthly Income</div>
                <div className="mt-1 text-lg font-semibold font-mono-tabular text-[var(--status-positive)]">
                  <MoneyAmount value={avgMonthly.income} currency={family.baseCurrency} />
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <div className="text-xs text-[var(--text-secondary)]">Avg. Monthly Expenses</div>
                <div className="mt-1 text-lg font-semibold font-mono-tabular">
                  <MoneyAmount value={avgMonthly.expenses} currency={family.baseCurrency} />
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <div className="text-xs text-[var(--text-secondary)]">Avg. Monthly Savings</div>
                <div className="mt-1 text-lg font-semibold font-mono-tabular">
                  <MoneyAmount
                    value={avgMonthly.savings}
                    currency={family.baseCurrency}
                    colorize
                    showSign
                  />
                </div>
              </div>
            </div>

            {showSankeyInTrends && (
              <div className="pt-2 border-t border-[var(--border-primary)]">
                <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
                  Period Cashflow Sankey
                </div>
                {incomeRows.length === 0 && sankeyRightNodes.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
                    No cashflow activity recorded in this period.
                  </div>
                ) : (
                  <CashflowSankeyChart
                    incomeNodes={incomeRows.map((inc) => ({
                      name: inc.name,
                      color: inc.color,
                      amount: inc.amount,
                      numericValue: Number(inc.amount),
                      formattedAmount: formatCurrency(inc.amount, family.baseCurrency),
                    }))}
                    outflowNodes={sankeyRightNodes.map((n) => ({
                      name: n.name,
                      color: n.color,
                      amount: n.amount,
                      numericValue: Number(n.amount),
                      formattedAmount: formatCurrency(n.amount, family.baseCurrency),
                    }))}
                    totalInflowFormatted={formatCurrency(periodIncome, family.baseCurrency)}
                    height={250}
                  />
                )}
              </div>
            )}

            {reportData?.spendingVsNormal && reportData.spendingVsNormal.categories.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-primary)]">
                <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
                  Spending vs. Historical Normal ({reportData.spendingVsNormal.currentMonth})
                </div>
                <div className="divide-y divide-[var(--border-primary)] rounded-xl border border-[var(--border-primary)] px-4">
                  {reportData.spendingVsNormal.categories.map((row) => (
                    <div
                      key={row.name}
                      className="py-2.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon
                          icon={categories.find((c) => c.name === row.name)?.icon}
                          label={row.name}
                          color={row.color}
                          variant="circle"
                          size="xs"
                        />
                        <span className="font-medium truncate">{row.name}</span>
                        <Pill
                          label={
                            row.status === 'ABOVE'
                              ? 'Above Normal'
                              : row.status === 'BELOW'
                              ? 'Below Normal'
                              : 'On Pace'
                          }
                          color={
                            row.status === 'ABOVE'
                              ? '#f59e0b'
                              : row.status === 'BELOW'
                              ? '#10b981'
                              : '#3b82f6'
                          }
                        />
                      </div>
                      <div className="flex items-center gap-4 shrink-0 font-mono-tabular">
                        <span className="text-[var(--text-secondary)]">
                          Normal:{' '}
                          <MoneyAmount value={row.normalAverage} currency={family.baseCurrency} />
                        </span>
                        <span className="font-semibold">
                          <MoneyAmount value={row.currentSpent} currency={family.baseCurrency} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section 2: Activity Breakdown (Screenshot #2) */}
      <Card padding="none">
        <div className="px-5 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActivityOpen((v) => !v)}
            className="flex items-center gap-2 text-left cursor-pointer"
          >
            {activityOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Activity Breakdown
            </span>
          </button>

          <Button
            size="sm"
            variant="secondary"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportActivityCsv}
          >
            CSV
          </Button>
        </div>

        {activityOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-[var(--border-primary)] space-y-6">
            {/* Income Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="w-4 h-4 text-[var(--status-positive)]" />
                <span>Income:</span>
                <span className="text-[var(--status-positive)] font-semibold">
                  <MoneyAmount value={periodIncome} currency={family.baseCurrency} />
                </span>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
                  <div className="col-span-6">Category</div>
                  <div className="col-span-3 text-right">Amount</div>
                  <div className="col-span-3 text-right">% of Total</div>
                </div>
                {incomeRows.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                    No categorized income entries in this period.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-primary)]">
                    {incomeRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-12 items-center px-4 py-2.5 text-xs bg-[var(--bg-surface)]"
                      >
                        <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                          <CategoryIcon
                            icon={row.icon}
                            label={row.name}
                            color={row.color}
                            variant="circle"
                            size="sm"
                          />
                          <span className="font-medium text-[var(--text-primary)] truncate">
                            {row.name}
                          </span>
                          <span className="text-[var(--text-muted)]">
                            ({row.count} {row.count === 1 ? 'entry' : 'entries'})
                          </span>
                        </div>
                        <div className="col-span-3 text-right font-mono-tabular font-semibold text-[var(--status-positive)]">
                          <MoneyAmount value={row.amount} currency={family.baseCurrency} />
                        </div>
                        <div className="col-span-3 text-right font-mono-tabular text-[var(--text-secondary)]">
                          {row.percentOfTotal}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expenses Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="w-4 h-4 text-[var(--text-secondary)]" />
                <span>Expenses:</span>
                <span className="font-semibold">
                  <MoneyAmount value={periodExpenses} currency={family.baseCurrency} />
                </span>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
                  <div className="col-span-6">Category</div>
                  <div className="col-span-3 text-right">Amount</div>
                  <div className="col-span-3 text-right">% of Total</div>
                </div>
                {expenseRows.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                    No expense entries in this period.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-primary)]">
                    {expenseRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-12 items-center px-4 py-2.5 text-xs bg-[var(--bg-surface)]"
                      >
                        <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                          <CategoryIcon
                            icon={row.icon}
                            label={row.name}
                            color={row.color}
                            variant="circle"
                            size="sm"
                          />
                          <span className="font-medium text-[var(--text-primary)] truncate">
                            {row.name}
                          </span>
                          <span className="text-[var(--text-muted)]">
                            ({row.count} {row.count === 1 ? 'entry' : 'entries'})
                          </span>
                        </div>
                        <div className="col-span-3 text-right font-mono-tabular font-semibold">
                          <MoneyAmount value={row.amount} currency={family.baseCurrency} />
                        </div>
                        <div className="col-span-3 text-right font-mono-tabular text-[var(--text-secondary)]">
                          {row.percentOfTotal}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Section 3: Net Worth Statement & Curve (Screenshot #3) */}
      <Card padding="none">
        <button
          type="button"
          onClick={() => setNetWorthOpen((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {netWorthOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">Net Worth</span>
          </div>
          <span className="text-xs text-[var(--text-secondary)] font-mono-tabular">
            {startDate} → {endDate}
          </span>
        </button>

        {netWorthOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-[var(--border-primary)] space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <div className="text-xs text-[var(--text-secondary)]">Current Net Worth</div>
                <div className="mt-1.5 text-2xl font-semibold font-mono-tabular text-[var(--status-positive)]">
                  <MoneyAmount value={summary.netWorth} currency={family.baseCurrency} />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <div className="text-xs text-[var(--text-secondary)]">Period Change</div>
                <div className="mt-1.5 text-2xl font-semibold font-mono-tabular">
                  <MoneyAmount
                    value={nwDelta}
                    currency={family.baseCurrency}
                    colorize
                    showSign
                  />
                </div>
                <div className="text-xs font-mono-tabular text-[var(--status-positive)] mt-0.5">
                  {Number(nwDeltaPct) >= 0 ? '+' : ''}
                  {nwDeltaPct}%
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <div className="text-xs text-[var(--text-secondary)]">Assets vs Liabilities</div>
                <div className="mt-1.5 text-sm font-semibold font-mono-tabular">
                  <MoneyAmount value={summary.totalAssets} currency={family.baseCurrency} />{' '}
                  <span className="text-[var(--text-muted)]">-</span>
                </div>
                <div className="text-sm font-semibold font-mono-tabular mt-0.5">
                  <MoneyAmount value={summary.totalLiabilities} currency={family.baseCurrency} />
                </div>
              </div>
            </div>

            <ResponsiveAreaChart
              data={nwSeries}
              height={190}
              color="#078C52"
              primaryLabel="Net Worth"
              formatValue={(val) => formatCurrency(val.toFixed(2), family.baseCurrency)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
                <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
                  Assets
                </div>
                <div className="divide-y divide-[var(--border-primary)]">
                  {assetSummaryGroups.map((g) => (
                    <div
                      key={g.label}
                      className="flex items-center justify-between px-4 py-2.5 text-xs bg-[var(--bg-surface)]"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <CategoryIcon
                          icon={g.icon}
                          label={g.label}
                          color={g.color}
                          variant="circle"
                          size="xs"
                        />
                        {g.label}
                      </span>
                      <MoneyAmount
                        value={g.total}
                        currency={family.baseCurrency}
                        className="font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
                <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
                  Liabilities
                </div>
                <div className="divide-y divide-[var(--border-primary)]">
                  {liabilitySummaryGroups.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                      No liability accounts recorded.
                    </div>
                  ) : (
                    liabilitySummaryGroups.map((g) => (
                      <div
                        key={g.label}
                        className="flex items-center justify-between px-4 py-2.5 text-xs bg-[var(--bg-surface)]"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <CategoryIcon
                            icon={g.icon}
                            label={g.label}
                            color={g.color}
                            variant="circle"
                            size="xs"
                          />
                          {g.label}
                        </span>
                        <MoneyAmount
                          value={g.total}
                          currency={family.baseCurrency}
                          className="font-semibold"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <InvestmentReportCard
        open={investmentOpen}
        onToggleOpen={() => setInvestmentOpen((v) => !v)}
        baseCurrency={family.baseCurrency}
        investmentAccounts={investmentAccounts}
        investmentPerf={investmentPerf}
        showHoldingDetails={showHoldingDetails}
        onToggleHoldingDetails={() => setShowHoldingDetails((v) => !v)}
      />

      <SyncConnectionsAndConflicts
        baseCurrency={family.baseCurrency}
        syncBanner={syncBanner}
        onDismissBanner={() => setSyncBanner(null)}
        conflicts={conflicts}
        onResolveConflict={resolveConflict}
        syncConnections={syncConnections}
        adapterCategories={adapterCategories}
        syncAdapters={syncAdapters}
        connectOpen={connectOpen}
        onOpenConnect={() => setConnectOpen(true)}
        onCloseConnect={() => setConnectOpen(false)}
        onSyncAll={handleSyncAll}
        onDeleteConnection={deleteProviderConnection}
        selectedAdapterKey={selectedAdapterKey}
        onChangeAdapterKey={setSelectedAdapterKey}
        institutionName={institutionName}
        onChangeInstitutionName={setInstitutionName}
        onConnectSubmit={handleConnect}
      />
    </div>
  );
};
