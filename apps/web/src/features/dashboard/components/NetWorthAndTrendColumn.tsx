import React from 'react';
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@sure/shared';
import {
  Card,
  MoneyAmount,
  MonthlyBarsChart,
  Pill,
  ResponsiveAreaChart,
  type MonthlyBarDatum,
} from '@sure/ui';
import type { LedgerContextValue } from '../../../lib/ledger-context.js';
import type { Timeframe } from './useDashboardMetrics.js';

interface NetWorthAndTrendColumnProps {
  baseCurrency: string;
  timeframe: Timeframe;
  summary: LedgerContextValue['summary'];
  seriesPoints: Array<{ date: string; value: number }>;
  deltaAmount: string;
  deltaPercent: string;
  monthlyBars: MonthlyBarDatum[];
  latestMonthTotals: { income: string; expenses: string; net: string };
  spendingPace: {
    currentTotal: string;
    priorTotal: string;
    delta: string;
    points: Array<{ date: string; value: number; comparisonValue: number }>;
  };
  netWorthOpen: boolean;
  onToggleNetWorth: () => void;
  moneyInOutOpen: boolean;
  onToggleMoneyInOut: () => void;
  spendingOpen: boolean;
  onToggleSpending: () => void;
}

export const NetWorthAndTrendColumn: React.FC<NetWorthAndTrendColumnProps> = ({
  baseCurrency,
  timeframe,
  summary,
  seriesPoints,
  deltaAmount,
  deltaPercent,
  monthlyBars,
  latestMonthTotals,
  spendingPace,
  netWorthOpen,
  onToggleNetWorth,
  moneyInOutOpen,
  onToggleMoneyInOut,
  spendingOpen,
  onToggleSpending,
}) => (
  <div className="xl:col-span-7 space-y-5">
    <Card padding="none">
      <div className="px-5 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleNetWorth}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          {netWorthOpen ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
          )}
          <span className="text-sm font-semibold text-[var(--text-primary)]">Net Worth</span>
        </button>
        <span className="text-xs text-[var(--text-secondary)] font-mono-tabular">{timeframe}</span>
      </div>

      {netWorthOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-primary)] pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-medium tracking-tight">
                <MoneyAmount value={summary.netWorth} currency={baseCurrency} />
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--status-positive)]" />
                <span className="font-mono-tabular font-medium">
                  <MoneyAmount value={deltaAmount} currency={baseCurrency} colorize showSign />
                </span>
                <Pill
                  label={`${Number(deltaPercent) >= 0 ? '↑' : '↓'} ${Math.abs(
                    Number(deltaPercent)
                  ).toFixed(1)}% vs. ${timeframe}`}
                  color={Number(deltaPercent) >= 0 ? '#078C52' : '#E24056'}
                  size="xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <div>
                <div>Income (30d)</div>
                <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                  <MoneyAmount value={summary.monthlyIncome} currency={baseCurrency} />
                </div>
              </div>
              <div>
                <div>Expenses (30d)</div>
                <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                  <MoneyAmount value={summary.monthlyExpenses} currency={baseCurrency} />
                </div>
              </div>
            </div>
          </div>

          <ResponsiveAreaChart
            data={seriesPoints}
            height={175}
            color="#078C52"
            primaryLabel="Net Worth"
            formatValue={(val) => formatCurrency(val.toFixed(2), baseCurrency)}
          />
        </div>
      )}
    </Card>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Card padding="none">
        <button
          type="button"
          onClick={onToggleMoneyInOut}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {moneyInOutOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">Money In / Out</span>
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
                  currency={baseCurrency}
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
                <MoneyAmount value={latestMonthTotals.income} currency={baseCurrency} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                  Expenses
                </span>
                <MoneyAmount value={latestMonthTotals.expenses} currency={baseCurrency} />
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card padding="none">
        <button
          type="button"
          onClick={onToggleSpending}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {spendingOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">Spending Pace</span>
          </div>
          <span className="text-[11px] text-[var(--text-secondary)]">MTD vs Prior</span>
        </button>

        {spendingOpen && (
          <div className="px-5 pb-4 pt-3 border-t border-[var(--border-primary)] space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-xs text-[var(--text-secondary)]">This month</div>
                <div className="text-xl font-medium tracking-tight">
                  <MoneyAmount value={spendingPace.currentTotal} currency={baseCurrency} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--text-secondary)]">Prior month</div>
                <div className="text-sm font-mono-tabular text-[var(--text-secondary)]">
                  <MoneyAmount value={spendingPace.priorTotal} currency={baseCurrency} />
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
              formatValue={(val) => formatCurrency(val.toFixed(2), baseCurrency)}
            />

            <div className="flex items-center justify-between text-xs pt-1 text-[var(--text-secondary)]">
              <span>Month-to-date variance</span>
              <MoneyAmount
                value={spendingPace.delta}
                currency={baseCurrency}
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
);
