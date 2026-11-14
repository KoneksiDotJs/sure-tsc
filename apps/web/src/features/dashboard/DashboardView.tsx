import React, { useMemo, useState } from 'react';
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
import {
  Card,
  Section,
  MoneyAmount,
  Sparkline,
  Pill,
  SegmentedControl,
  Button,
  CategoryIcon,
  ResponsiveAreaChart,
  CashflowSankeyChart,
  OutflowsDonutChart,
  MonthlyBarsChart,
  type SankeyFlowItem,
  type DonutSlice,
  type MonthlyBarDatum,
} from '@sure/ui';
import { useLedger, WebAccount } from '../../lib/ledger-context.js';
import { useAuth } from '../auth/AuthContext.js';
import {
  ArrowUpRight,
  ArrowLeftRight,
  Sparkles,
  TrendingUp,
  Layers,
  Plus,
  ChevronDown,
  ChevronRight,
  Lock,
  Maximize2,
  Minimize2,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

type Timeframe = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

interface BalanceGroupRow {
  key: string;
  label: string;
  icon: string;
  classification: 'ASSET' | 'LIABILITY';
  color: string;
  total: string;
  weightPercent: string;
  accounts: WebAccount[];
}

export const DashboardView: React.FC<{
  onNavigate: (tab: string) => void;
  onOpenAiDrawer: () => void;
}> = ({ onNavigate, onOpenAiDrawer }) => {
  const { session } = useAuth();
  const { family, accounts, categories, entries, insights, summary, reportData } = useLedger();
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [cashflowOpen, setCashflowOpen] = useState(true);
  const [cashflowExpanded, setCashflowExpanded] = useState(false);
  const [outflowsOpen, setOutflowsOpen] = useState(true);
  const [netWorthOpen, setNetWorthOpen] = useState(true);
  const [moneyInOutOpen, setMoneyInOutOpen] = useState(true);
  const [spendingOpen, setSpendingOpen] = useState(true);
  const [balanceSheetOpen, setBalanceSheetOpen] = useState(true);
  const [hoveredOutflowId, setHoveredOutflowId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    DEPOSITORY: true,
    INVESTMENT: true,
  });

  const firstName = useMemo(() => {
    const raw = session?.user.name?.trim();
    if (!raw) return 'there';
    return raw.split(/\s+/)[0] ?? raw;
  }, [session?.user.name]);

  // 1. Net Worth Timeframe Series & Delta % (uses |first| as denominator to avoid sign inversion)
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

  // 2. Cashflow Sankey + Outflows Category Donut Data
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
        formattedAmount: formatCurrency(inc.amount, family.baseCurrency),
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
        formattedAmount: formatCurrency(exp.amount, family.baseCurrency),
      }));

      const surplus = subMoney(totalInc, totalOut);
      if (compareMoney(surplus, '0.0000') > 0) {
        expItems.push({
          name: 'Surplus',
          color: '#078C52',
          amount: surplus,
          numericValue: Number(surplus),
          formattedAmount: formatCurrency(surplus, family.baseCurrency),
        });
      }

      const sortedExpenses = [...rawExpenses].sort((a, b) => compareMoney(b.amount, a.amount));
      const catRows = sortedExpenses.map((exp) => {
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
        totalInflowFormatted: formatCurrency(totalInc, family.baseCurrency),
      };
    }, [reportData, entries, categories, family.baseCurrency]);

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

  // 3. Money In / Out 6-Month Bar Data
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
        incomeFormatted: formatCurrency(b.inc, family.baseCurrency),
        expensesFormatted: formatCurrency(b.exp, family.baseCurrency),
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
  }, [entries, family.baseCurrency]);

  // 4. Spending Pace Curve (Current Month vs Prior Month)
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

  // 5. Balance Sheet Groups with Account Icons
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
      for (const acc of matching) {
        total = addMoney(total, acc.balance);
      }
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
    const segments = [...aGroups, ...lGroups].map((g) => ({
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

  const renderGroupRows = (groups: BalanceGroupRow[]) =>
    groups.map((group) => {
      const open = Boolean(expandedGroups[group.key]);
      return (
        <div
          key={group.key}
          className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] overflow-hidden"
        >
          <button
            type="button"
            onClick={() =>
              setExpandedGroups((prev) => ({
                ...prev,
                [group.key]: !open,
              }))
            }
            className="w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-sm hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
          >
            <div className="col-span-6 flex items-center gap-2 text-left min-w-0">
              {open ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              )}
              <CategoryIcon
                icon={group.icon}
                label={group.label}
                color={group.color}
                variant="circle"
                size="xs"
              />
              <span className="font-medium text-[var(--text-primary)] truncate">
                {group.label}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
                ({group.accounts.length})
              </span>
            </div>
            <div className="col-span-3 text-right font-mono-tabular text-xs text-[var(--text-secondary)]">
              {group.weightPercent}%
            </div>
            <div className="col-span-3 text-right font-mono-tabular font-semibold">
              <MoneyAmount value={group.total} currency={family.baseCurrency} />
            </div>
          </button>

          {open && (
            <div className="border-t border-[var(--border-primary)] divide-y divide-[var(--border-primary)] bg-[var(--bg-surface-subtle)]/40">
              {group.accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => onNavigate('accounts')}
                  className="grid grid-cols-12 items-center px-4 py-2 pl-10 text-xs hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
                >
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <CategoryIcon
                      icon={acc.icon || group.icon}
                      label={acc.name}
                      color={acc.color}
                      variant="inline"
                      size="xs"
                    />
                    <span className="truncate font-medium text-[var(--text-primary)]">
                      {acc.name}
                    </span>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <Sparkline data={acc.sparkline} width={64} height={18} color={acc.color} />
                  </div>
                  <div className="col-span-3 text-right font-mono-tabular font-medium">
                    <MoneyAmount value={acc.balance} currency={acc.currency} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="space-y-5">
      {/* Sure Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)]">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Here&apos;s what&apos;s happening with your finances in {family.baseCurrency}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={onOpenAiDrawer}
          >
            Ask AI
          </Button>
          <Button
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('accounts')}
          >
            New Account
          </Button>
        </div>
      </div>

      {/* Quick Summary & Timeframe Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span>
            Assets:{' '}
            <strong className="text-[var(--text-primary)]">
              <MoneyAmount value={summary.totalAssets} currency={family.baseCurrency} />
            </strong>
          </span>
          <span>•</span>
          <span>
            Liabilities:{' '}
            <strong className="text-[var(--text-primary)]">
              <MoneyAmount value={summary.totalLiabilities} currency={family.baseCurrency} />
            </strong>
          </span>
          <span>•</span>
          <span>
            Monthly Cash Flow:{' '}
            <strong>
              <MoneyAmount
                value={summary.monthlyNetSavings}
                currency={family.baseCurrency}
                colorize
                showSign
              />
            </strong>
          </span>
        </div>

        <SegmentedControl<Timeframe>
          options={[
            { value: '1M', label: '1M' },
            { value: '3M', label: '3M' },
            { value: '6M', label: '6M' },
            { value: 'YTD', label: 'YTD' },
            { value: '1Y', label: '1Y' },
            { value: 'ALL', label: 'ALL' },
          ]}
          value={timeframe}
          onChange={setTimeframe}
          size="sm"
        />
      </div>

      {/* Collapsible Widget 1: Interactive Cashflow Sankey (matches app.sure.am screenshot #1) */}
      <Card padding="none">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCashflowOpen((v) => !v)}
            className="flex items-center gap-2 text-left cursor-pointer"
          >
            {cashflowOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">Cashflow</span>
          </button>

          <div className="flex items-center gap-2">
            <Pill label={savingsRateLabel} color="#078C52" size="xs" />
            <button
              type="button"
              onClick={() => setCashflowExpanded((v) => !v)}
              aria-label={cashflowExpanded ? 'Compact cashflow height' : 'Expand cashflow height'}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
            >
              {cashflowExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {cashflowOpen && (
          <div className="px-5 pb-5 pt-2 border-t border-[var(--border-primary)]">
            {incomeNodes.length === 0 && outflowNodes.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
                Record income and expense transactions to visualize your cashflow streams.
              </div>
            ) : (
              <CashflowSankeyChart
                incomeNodes={incomeNodes}
                outflowNodes={outflowNodes}
                totalInflowFormatted={totalInflowFormatted}
                height={cashflowExpanded ? 380 : 270}
              />
            )}
          </div>
        )}
      </Card>

      {/* Primary Two-Column Bento Row: Outflows Donut + Responsive Net Worth Curve (screenshot #3) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Outflows Card (5 cols) */}
        <Card padding="none" className="xl:col-span-5">
          <button
            type="button"
            onClick={() => setOutflowsOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {outflowsOpen ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
              )}
              <span className="text-sm font-semibold text-[var(--text-primary)]">Outflows</span>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">
              {outflowCategories.length} categories
            </span>
          </button>

          {outflowsOpen && (
            <div className="px-5 pb-5 pt-2 border-t border-[var(--border-primary)] space-y-5">
              <div className="flex justify-center pt-1">
                <OutflowsDonutChart
                  slices={donutSlices}
                  centerLabel="Total Outflows"
                  centerValue={
                    <MoneyAmount value={totalOutflowAmount} currency={family.baseCurrency} />
                  }
                  activeId={hoveredOutflowId}
                  onHoverChange={setHoveredOutflowId}
                />
              </div>

              <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] p-2 space-y-1">
                <div className="grid grid-cols-12 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  <div className="col-span-6">Categories • {outflowCategories.length}</div>
                  <div className="col-span-4 text-right">Value</div>
                  <div className="col-span-2 text-right">Weight</div>
                </div>

                {outflowCategories.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-lg">
                    No outflows in selected period.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {outflowCategories.map((cat) => {
                      const highlighted = hoveredOutflowId === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onMouseEnter={() => setHoveredOutflowId(cat.id)}
                          onMouseLeave={() => setHoveredOutflowId(null)}
                          onClick={() => onNavigate('transactions')}
                          className={`grid grid-cols-12 items-center px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            highlighted
                              ? 'bg-[var(--bg-surface-hover)] ring-1 ring-[var(--border-strong)]'
                              : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                          }`}
                        >
                          <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                            <CategoryIcon
                              icon={cat.icon}
                              label={cat.name}
                              color={cat.color}
                              variant="circle"
                              size="sm"
                            />
                            <span className="truncate font-medium text-[var(--text-primary)]">
                              {cat.name}
                            </span>
                          </div>
                          <div className="col-span-4 text-right font-mono-tabular font-semibold">
                            <MoneyAmount value={cat.amount} currency={family.baseCurrency} />
                          </div>
                          <div className="col-span-2 text-right font-mono-tabular text-[var(--text-secondary)]">
                            {cat.weightPercent}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Right Stack: Net Worth + Money In / Out & Spending (7 cols) */}
        <div className="xl:col-span-7 space-y-5">
          {/* Responsive Net Worth Card */}
          <Card padding="none">
            <div className="px-5 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setNetWorthOpen((v) => !v)}
                className="flex items-center gap-2 text-left cursor-pointer"
              >
                {netWorthOpen ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                )}
                <span className="text-sm font-semibold text-[var(--text-primary)]">Net Worth</span>
              </button>
              <span className="text-xs text-[var(--text-secondary)] font-mono-tabular">
                {timeframe}
              </span>
            </div>

            {netWorthOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-primary)] pt-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div>
                    <div className="text-3xl font-medium tracking-tight">
                      <MoneyAmount value={summary.netWorth} currency={family.baseCurrency} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--status-positive)]" />
                      <span className="font-mono-tabular font-medium">
                        <MoneyAmount
                          value={deltaAmount}
                          currency={family.baseCurrency}
                          colorize
                          showSign
                        />
                      </span>
                      <Pill
                        label={`${Number(deltaPercent) >= 0 ? '↑' : '↓'} ${Math.abs(Number(deltaPercent)).toFixed(1)}% vs. ${timeframe}`}
                        color={Number(deltaPercent) >= 0 ? '#078C52' : '#E24056'}
                        size="xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                    <div>
                      <div>Income (30d)</div>
                      <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                        <MoneyAmount value={summary.monthlyIncome} currency={family.baseCurrency} />
                      </div>
                    </div>
                    <div>
                      <div>Expenses (30d)</div>
                      <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                        <MoneyAmount value={summary.monthlyExpenses} currency={family.baseCurrency} />
                      </div>
                    </div>
                  </div>
                </div>

                <ResponsiveAreaChart
                  data={seriesPoints}
                  height={175}
                  color="#078C52"
                  primaryLabel="Net Worth"
                  formatValue={(val) => formatCurrency(val.toFixed(2), family.baseCurrency)}
                />
              </div>
            )}
          </Card>

          {/* Money In / Out + Spending Sub-grid (screenshot #4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card padding="none">
              <button
                type="button"
                onClick={() => setMoneyInOutOpen((v) => !v)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {moneyInOutOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                  )}
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    Money In / Out
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)]">Last 6 months</span>
              </button>

              {moneyInOutOpen && (
                <div className="px-5 pb-4 pt-2 border-t border-[var(--border-primary)] space-y-3">
                  <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#078C52]" />
                      Income
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                      Expenses
                    </span>
                  </div>

                  <MonthlyBarsChart data={monthlyBars} height={155} />

                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                      <span>Transaction balance</span>
                      <MoneyAmount
                        value={latestMonthTotals.net}
                        currency={family.baseCurrency}
                        colorize
                        showSign
                        className="font-semibold"
                      />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-[#078C52]" />
                        Income
                      </span>
                      <MoneyAmount value={latestMonthTotals.income} currency={family.baseCurrency} />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                        Expenses
                      </span>
                      <MoneyAmount
                        value={latestMonthTotals.expenses}
                        currency={family.baseCurrency}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card padding="none">
              <button
                type="button"
                onClick={() => setSpendingOpen((v) => !v)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {spendingOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                  )}
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    Spending Pace
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)]">MTD vs Prior</span>
              </button>

              {spendingOpen && (
                <div className="px-5 pb-4 pt-3 border-t border-[var(--border-primary)] space-y-3">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-xs text-[var(--text-secondary)]">This month</div>
                      <div className="text-xl font-medium tracking-tight">
                        <MoneyAmount
                          value={spendingPace.currentTotal}
                          currency={family.baseCurrency}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[var(--text-secondary)]">Prior month</div>
                      <div className="text-sm font-mono-tabular text-[var(--text-secondary)]">
                        <MoneyAmount
                          value={spendingPace.priorTotal}
                          currency={family.baseCurrency}
                        />
                      </div>
                    </div>
                  </div>

                  <ResponsiveAreaChart
                    data={spendingPace.points}
                    height={165}
                    color="#078C52"
                    comparisonColor="#9ca3af"
                    primaryLabel="This Month"
                    comparisonLabel="Prior Month"
                    formatValue={(val) => formatCurrency(val.toFixed(2), family.baseCurrency)}
                  />

                  <div className="flex items-center justify-between text-xs pt-1 text-[var(--text-secondary)]">
                    <span>Month-to-date variance</span>
                    <MoneyAmount
                      value={spendingPace.delta}
                      currency={family.baseCurrency}
                      colorize
                      showSign
                      className="font-semibold"
                    />
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Collapsible Balance Sheet Breakdown */}
      <Card padding="none">
        <button
          type="button"
          onClick={() => setBalanceSheetOpen((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-hover)]/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {balanceSheetOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">Balance Sheet</span>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            {accounts.length} active accounts
          </span>
        </button>

        {balanceSheetOpen && (
          <div className="px-5 pb-5 space-y-5 border-t border-[var(--border-primary)] pt-4">
            {mixSegments.length > 0 && (
              <div className="space-y-2.5">
                <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[var(--bg-surface-subtle)] gap-0.5">
                  {mixSegments.map((seg) => (
                    <div
                      key={seg.key}
                      style={{
                        width: `${Math.max(seg.weight, 2)}%`,
                        backgroundColor: seg.color,
                      }}
                      title={`${seg.label}: ${seg.weight.toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                  {mixSegments.map((seg) => (
                    <div key={seg.key} className="flex items-center gap-1.5">
                      <CategoryIcon
                        icon={seg.icon}
                        label={seg.label}
                        color={seg.color}
                        variant="inline"
                        size="xs"
                      />
                      <span className="text-[var(--text-secondary)]">{seg.label}</span>
                      <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                        {seg.weight.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Assets</span>
                  <span className="text-sm font-mono-tabular font-semibold">
                    <MoneyAmount value={summary.totalAssets} currency={family.baseCurrency} />
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] space-y-1.5">
                  <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-3 text-right">Weight</div>
                    <div className="col-span-3 text-right">Value</div>
                  </div>
                  {assetGroups.length > 0 ? (
                    renderGroupRows(assetGroups)
                  ) : (
                    <div className="p-4 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-lg">
                      No asset accounts yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Liabilities
                  </span>
                  <span className="text-sm font-mono-tabular font-semibold">
                    <MoneyAmount value={summary.totalLiabilities} currency={family.baseCurrency} />
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] space-y-1.5">
                  <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-3 text-right">Weight</div>
                    <div className="col-span-3 text-right">Value</div>
                  </div>
                  {liabilityGroups.length > 0 ? (
                    renderGroupRows(liabilityGroups)
                  ) : (
                    <div className="p-4 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-lg">
                      No liability accounts yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Bottom Row: Recent Ledger Activity (with Category Icons) & Proactive Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section
          title="Recent Ledger Activity"
          description="Transactions, Valuations & Security Trades"
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('transactions')}
              icon={<Layers className="w-3.5 h-3.5" />}
            >
              Open Ledger
            </Button>
          }
        >
          <Card padding="none">
            <div className="divide-y divide-[var(--border-primary)]">
              {entries.slice(0, 6).map((entry) => {
                const cat = categories.find((c) => c.id === entry.categoryId);
                const acc = accounts.find((a) => a.id === entry.accountId);
                return (
                  <div
                    key={entry.id}
                    onClick={() => onNavigate('transactions')}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] shrink-0">
                        {(entry.name[0] ?? 'T').toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {entry.name}
                          </span>
                          {entry.entryType === 'TRANSACTION' && !entry.transferMatchId && cat && (
                            <Pill
                              label={cat.name}
                              color={cat.color}
                              icon={
                                <CategoryIcon
                                  icon={cat.icon}
                                  label={cat.name}
                                  color={cat.color}
                                  variant="inline"
                                  size="xs"
                                />
                              }
                              size="xs"
                            />
                          )}
                          {entry.transferMatchId && (
                            <Pill
                              label="Transfer"
                              color="#3b82f6"
                              icon={<ArrowLeftRight className="w-3 h-3" />}
                              size="xs"
                            />
                          )}
                          {entry.entryType === 'TRADE' && (
                            <Pill
                              label="TRADE"
                              color="#078C52"
                              icon={<TrendingUp className="w-3 h-3" />}
                              size="xs"
                            />
                          )}
                          {entry.entryType === 'VALUATION' && (
                            <Pill
                              label="VALUATION"
                              color="#8b5cf6"
                              icon={<Scale className="w-3 h-3" />}
                              size="xs"
                            />
                          )}
                        </div>
                        <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5 truncate">
                          {entry.date} • {acc?.name ?? entry.accountId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm font-semibold shrink-0">
                      {(entry.importId || entry.transferMatchId) && (
                        <Lock className="w-3 h-3 text-[var(--text-muted)]" />
                      )}
                      <MoneyAmount
                        value={entry.amount}
                        currency={entry.currency}
                        colorize={entry.entryType === 'TRANSACTION'}
                        showSign={entry.entryType === 'TRANSACTION'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Section>

        <Section
          title="Proactive Insights"
          description="Background anomaly detection & cash-flow checks"
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('reports')}
              icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              View Reports
            </Button>
          }
        >
          <Card padding="none">
            {insights.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                No cash-flow anomalies or alerts detected.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)]">
                {insights.map((ins) => {
                  const statusColor =
                    ins.severity === 'POSITIVE'
                      ? '#078C52'
                      : ins.severity === 'WARNING'
                      ? '#f59e0b'
                      : '#3b82f6';
                  const StatusIcon =
                    ins.severity === 'POSITIVE'
                      ? CheckCircle2
                      : ins.severity === 'WARNING'
                      ? AlertTriangle
                      : Info;
                  return (
                    <div
                      key={ins.id}
                      className="flex items-start justify-between gap-3 px-4 py-3.5"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            backgroundColor: `${statusColor}1A`,
                            color: statusColor,
                          }}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)]">
                            {ins.title}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {ins.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs font-mono-tabular font-semibold text-[var(--text-primary)] shrink-0 pt-0.5">
                        <MoneyAmount value={ins.metricAmount} currency={family.baseCurrency} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Section>
      </div>
    </div>
  );
};
