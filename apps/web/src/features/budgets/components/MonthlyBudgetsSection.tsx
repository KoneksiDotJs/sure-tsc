import React, { useMemo } from 'react';
import { calculateBudgetRollover, compareMoney } from '@sure/shared';
import {
  Card,
  CategoryIcon,
  MoneyAmount,
  MoneyField,
  Pill,
  ProgressRing,
  Section,
  Toggle,
} from '@sure/ui';
import type { LedgerContextValue, WebCategory } from '../../../lib/ledger-context.js';

interface MonthlyBudgetsSectionProps {
  baseCurrency: string;
  categories: WebCategory[];
  budgetMonth: string;
  onChangeBudgetMonth: (month: string) => void;
  serverBudgetRows: LedgerContextValue['budgetRows'];
  budgetRolloverEnabled: boolean;
  onToggleRollover: (enabled: boolean) => Promise<void> | void;
  budgetAllocations: Record<string, string>;
  onUpdateAllocation: (categoryId: string, amount: string) => Promise<void> | void;
}

export const MonthlyBudgetsSection: React.FC<MonthlyBudgetsSectionProps> = ({
  baseCurrency,
  categories,
  budgetMonth,
  onChangeBudgetMonth,
  serverBudgetRows,
  budgetRolloverEnabled,
  onToggleRollover,
  budgetAllocations,
  onUpdateAllocation,
}) => {
  const budgetRows = useMemo(() => {
    if (serverBudgetRows.length > 0) {
      return serverBudgetRows.map((row) => ({
        category: row.category,
        budgeted: budgetAllocations[row.category.id] ?? row.budgetedAmount,
        actualSpent: row.actualSpent,
        priorRollover: row.previousRolloverBalance,
        effectiveAvailable: row.effectiveAvailable,
        remainingBalance: row.remainingBalance,
        utilizationPercent: row.utilizationPercent,
        isOverBudget: row.isOverBudget,
      }));
    }

    return categories
      .filter((c) => c.classification === 'EXPENSE')
      .map((cat) => {
        const budgeted = budgetAllocations[cat.id] ?? '500.0000';
        const computed = calculateBudgetRollover({
          budgetedAmount: budgeted,
          actualSpentAmount: '0.0000',
          previousRolloverBalance: '0.0000',
          rolloverEnabled: budgetRolloverEnabled,
        });
        return {
          category: cat,
          budgeted,
          actualSpent: '0.0000',
          priorRollover: '0.0000',
          ...computed,
        };
      });
  }, [serverBudgetRows, categories, budgetAllocations, budgetRolloverEnabled]);

  return (
    <Section
      title="Monthly Category Budgeting & Rollover (FR-4.1)"
      description="Carries prior-month unspent surpluses or deficits forward via PostgreSQL RolloverCalculator"
      action={
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="month"
            value={budgetMonth}
            onChange={(e) => onChangeBudgetMonth(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
          />
          <Toggle
            checked={budgetRolloverEnabled}
            onChange={(v) => void onToggleRollover(v)}
            label="Carryover Monthly Rollover"
          />
        </div>
      }
    >
      <Card padding="none">
        <div className="divide-y divide-[var(--border-primary)]">
          {budgetRows.map((row) => {
            const pct = Number(row.utilizationPercent);
            return (
              <div
                key={row.category.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div className="flex items-center gap-3.5 min-w-[220px]">
                  <ProgressRing
                    percentage={pct}
                    color={row.isOverBudget ? 'var(--status-negative)' : row.category.color}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CategoryIcon
                        icon={row.category.icon}
                        label={row.category.name}
                        color={row.category.color}
                        variant="circle"
                        size="xs"
                      />
                      <span className="text-sm font-semibold">{row.category.name}</span>
                      {budgetRolloverEnabled &&
                        compareMoney(row.priorRollover, '0.0000') !== 0 && (
                          <Pill
                            label={`${
                              compareMoney(row.priorRollover, '0.0000') >= 0 ? '+' : ''
                            }$${Number(row.priorRollover).toFixed(0)} Rollover`}
                            color={
                              compareMoney(row.priorRollover, '0.0000') >= 0
                                ? '#10b981'
                                : '#ef4444'
                            }
                          />
                        )}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Spent <MoneyAmount value={row.actualSpent} currency={baseCurrency} /> of{' '}
                      <MoneyAmount value={row.effectiveAvailable} currency={baseCurrency} />{' '}
                      effective
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-40">
                    <MoneyField
                      value={row.budgeted}
                      onChange={(val) => void onUpdateAllocation(row.category.id, val)}
                      currency={baseCurrency}
                    />
                  </div>
                  <div className="text-right min-w-[120px]">
                    <div className="text-xs text-[var(--text-secondary)]">Remaining</div>
                    <div className="text-sm font-bold">
                      <MoneyAmount
                        value={row.remainingBalance}
                        currency={baseCurrency}
                        colorize
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </Section>
  );
};
