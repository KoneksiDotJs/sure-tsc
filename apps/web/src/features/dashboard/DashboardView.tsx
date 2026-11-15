import React, { useMemo, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button, MoneyAmount, SegmentedControl } from '@sure/ui';
import { useLedger } from '../../lib/ledger-context.js';
import { useAuth } from '../auth/AuthContext.js';
import { useDashboardMetrics, type Timeframe } from './components/useDashboardMetrics.js';
import { CashflowSankeyCard } from './components/CashflowSankeyCard.js';
import { OutflowsDonutCard } from './components/OutflowsDonutCard.js';
import { NetWorthAndTrendColumn } from './components/NetWorthAndTrendColumn.js';
import { BalanceSheetBreakdownCard } from './components/BalanceSheetBreakdownCard.js';
import { RecentActivityAndInsightsRow } from './components/RecentActivityAndInsightsRow.js';

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

  const metrics = useDashboardMetrics({
    timeframe,
    baseCurrency: family.baseCurrency,
    accounts,
    categories,
    entries,
    summary,
    reportData,
  });

  return (
    <div className="space-y-5">
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

      <CashflowSankeyCard
        open={cashflowOpen}
        expanded={cashflowExpanded}
        onToggleOpen={() => setCashflowOpen((v) => !v)}
        onToggleExpanded={() => setCashflowExpanded((v) => !v)}
        savingsRateLabel={metrics.savingsRateLabel}
        incomeNodes={metrics.incomeNodes}
        outflowNodes={metrics.outflowNodes}
        totalInflowFormatted={metrics.totalInflowFormatted}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <OutflowsDonutCard
          open={outflowsOpen}
          onToggleOpen={() => setOutflowsOpen((v) => !v)}
          baseCurrency={family.baseCurrency}
          outflowCategories={metrics.outflowCategories}
          donutSlices={metrics.donutSlices}
          totalOutflowAmount={metrics.totalOutflowAmount}
          hoveredOutflowId={hoveredOutflowId}
          onHoverChange={setHoveredOutflowId}
          onNavigateTransactions={() => onNavigate('transactions')}
        />

        <NetWorthAndTrendColumn
          baseCurrency={family.baseCurrency}
          timeframe={timeframe}
          summary={summary}
          seriesPoints={metrics.seriesPoints}
          deltaAmount={metrics.deltaAmount}
          deltaPercent={metrics.deltaPercent}
          monthlyBars={metrics.monthlyBars}
          latestMonthTotals={metrics.latestMonthTotals}
          spendingPace={metrics.spendingPace}
          netWorthOpen={netWorthOpen}
          onToggleNetWorth={() => setNetWorthOpen((v) => !v)}
          moneyInOutOpen={moneyInOutOpen}
          onToggleMoneyInOut={() => setMoneyInOutOpen((v) => !v)}
          spendingOpen={spendingOpen}
          onToggleSpending={() => setSpendingOpen((v) => !v)}
        />
      </div>

      <BalanceSheetBreakdownCard
        open={balanceSheetOpen}
        onToggleOpen={() => setBalanceSheetOpen((v) => !v)}
        accountCount={accounts.length}
        baseCurrency={family.baseCurrency}
        totalAssets={summary.totalAssets}
        totalLiabilities={summary.totalLiabilities}
        mixSegments={metrics.mixSegments}
        assetGroups={metrics.assetGroups}
        liabilityGroups={metrics.liabilityGroups}
        expandedGroups={expandedGroups}
        onToggleGroup={(key) =>
          setExpandedGroups((prev) => ({
            ...prev,
            [key]: !prev[key],
          }))
        }
        onNavigateAccounts={() => onNavigate('accounts')}
      />

      <RecentActivityAndInsightsRow
        baseCurrency={family.baseCurrency}
        entries={entries}
        categories={categories}
        accounts={accounts}
        insights={insights}
        onNavigate={onNavigate}
      />
    </div>
  );
};
