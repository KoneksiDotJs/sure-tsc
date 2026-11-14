import React, { useMemo, useState } from 'react';
import {
  subMoney,
  divMoney,
  mulMoney,
  absMoney,
  compareMoney,
  calculateBudgetRollover,
  RecurringCadence,
} from '@sure/shared';
import {
  Card,
  Section,
  MoneyAmount,
  MoneyField,
  ProgressRing,
  Pill,
  Toggle,
  Button,
  CategoryIcon,
  Dialog,
  SegmentedControl,
} from '@sure/ui';
import { useLedger } from '../../lib/ledger-context.js';
import { Plus, AlertTriangle, Calendar, Target, CheckCircle2, Trash2 } from 'lucide-react';

export const BudgetsAndGoalsView: React.FC = () => {
  const {
    family,
    accounts,
    categories,
    goals,
    recurring,
    budgetMonth,
    setBudgetMonth,
    budgetRows: serverBudgetRows,
    budgetRolloverEnabled,
    setBudgetRolloverEnabled,
    budgetAllocations,
    updateBudgetAllocation,
    createGoal,
    deleteGoal,
    createRecurringBill,
    markRecurringPaid,
    deleteRecurringBill,
  } = useLedger();

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('50000.0000');
  const [goalCurrent, setGoalCurrent] = useState('12000.0000');
  const [goalPledge, setGoalPledge] = useState('1500.0000');
  const [goalTargetDate, setGoalTargetDate] = useState('2027-12-31');
  const [goalLinkedAccountIds, setGoalLinkedAccountIds] = useState<string[]>([]);

  const fundableAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.accountType === 'DEPOSITORY' ||
          a.accountType === 'INVESTMENT' ||
          a.accountType === 'CRYPTO'
      ),
    [accounts]
  );

  const [billsViewMode, setBillsViewMode] = useState<'list' | 'calendar'>('list');
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('-125.0000');
  const [billCadence, setBillCadence] = useState<RecurringCadence>('MONTHLY');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billAccountId, setBillAccountId] = useState(accounts[0]?.id ?? '');
  const [billCategoryId, setBillCategoryId] = useState<string>('');

  const effectiveBillAccountId = accounts.some((a) => a.id === billAccountId)
    ? billAccountId
    : (accounts[0]?.id ?? '');

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

  const calendarDays = useMemo(() => {
    const [yearStr = '2026', monthStr = '11'] = budgetMonth.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const days: Array<{
      day: number;
      iso: string;
      bills: typeof recurring;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${budgetMonth}-${String(d).padStart(2, '0')}`;
      const bills = recurring.filter((r) => {
        if (r.nextOccurrenceDate === iso) return true;
        if (r.cadence === 'MONTHLY' && r.nextOccurrenceDate.endsWith(`-${String(d).padStart(2, '0')}`)) {
          return true;
        }
        return false;
      });
      days.push({ day: d, iso, bills });
    }
    return days;
  }, [budgetMonth, recurring]);

  return (
    <div className="space-y-8">
      {/* FR-4.1 Monthly Budgeting with Rollover */}
      <Section
        title="Monthly Category Budgeting & Rollover (FR-4.1)"
        description="Carries prior-month unspent surpluses or deficits forward via PostgreSQL RolloverCalculator"
        action={
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="month"
              value={budgetMonth}
              onChange={(e) => setBudgetMonth(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
            <Toggle
              checked={budgetRolloverEnabled}
              onChange={(v) => void setBudgetRolloverEnabled(v)}
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
                        Spent <MoneyAmount value={row.actualSpent} currency={family.baseCurrency} /> of{' '}
                        <MoneyAmount value={row.effectiveAvailable} currency={family.baseCurrency} /> effective
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="w-40">
                      <MoneyField
                        value={row.budgeted}
                        onChange={(val) => void updateBudgetAllocation(row.category.id, val)}
                        currency={family.baseCurrency}
                      />
                    </div>
                    <div className="text-right min-w-[120px]">
                      <div className="text-xs text-[var(--text-secondary)]">Remaining</div>
                      <div className="text-sm font-bold">
                        <MoneyAmount
                          value={row.remainingBalance}
                          currency={family.baseCurrency}
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

      {/* FR-4.2 Financial Goals */}
      <Section
        title="Savings & Investment Goals (FR-4.2)"
        description="Track target-date projections and monthly contribution pledges"
        action={
          <Button
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setGoalModalOpen(true)}
          >
            New Goal
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct =
              compareMoney(g.targetAmount, '0.0000') > 0
                ? Number(divMoney(mulMoney(g.currentAmount, '100.0000'), g.targetAmount))
                : 0;
            const remainingRaw = subMoney(g.targetAmount, g.currentAmount);
            const remaining = compareMoney(remainingRaw, '0.0000') > 0 ? remainingRaw : '0.0000';
            const statusLabel =
              g.status === 'REACHED'
                ? 'Reached'
                : g.status === 'BEHIND'
                  ? 'Behind'
                  : 'On Track';
            const statusColor =
              g.status === 'REACHED'
                ? '#10b981'
                : g.status === 'BEHIND'
                  ? '#f59e0b'
                  : '#3b82f6';
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <ProgressRing percentage={pct} size={52} color={g.color} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-[var(--text-primary)]">
                          {g.name}
                        </h4>
                        <Pill label={statusLabel} color={statusColor} />
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                        <Target className="w-3.5 h-3.5" /> Target Date: {g.targetDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pill label={`+$${Number(g.monthlyPledge).toFixed(0)}/mo pledge`} color={g.color} />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="w-3.5 h-3.5 text-[var(--status-negative)]" />}
                      onClick={() => void deleteGoal(g.id)}
                    />
                  </div>
                </div>
                {g.linkedAccounts && g.linkedAccounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-[11px] text-[var(--text-secondary)]">Funded by:</span>
                    {g.linkedAccounts.map((acc) => (
                      <Pill key={acc.id} label={acc.name} color={acc.color} />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[var(--border-primary)] text-xs">
                  <div>
                    <div className="text-[var(--text-secondary)]">Saved So Far</div>
                    <div className="font-bold mt-0.5">
                      <MoneyAmount value={g.currentAmount} currency={family.baseCurrency} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-secondary)]">Target Goal</div>
                    <div className="font-bold mt-0.5">
                      <MoneyAmount value={g.targetAmount} currency={family.baseCurrency} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-secondary)]">Remaining</div>
                    <div className="font-bold mt-0.5">
                      <MoneyAmount value={remaining} currency={family.baseCurrency} />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* FR-4.3 Recurring Bills & Pay-Period Calendar */}
      <Section
        title="Recurring Bills & Income Plan (FR-4.3)"
        description="Track bills with overview & calendar views, custom repeat cadences, price-hike alerts, and payment recording"
        action={
          <div className="flex items-center gap-3">
            <SegmentedControl<'list' | 'calendar'>
              options={[
                { value: 'list', label: 'Overview' },
                { value: 'calendar', label: 'Calendar' },
              ]}
              value={billsViewMode}
              onChange={setBillsViewMode}
            />
            <Button
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setBillModalOpen(true)}
            >
              Add Bill
            </Button>
          </div>
        }
      >
        {billsViewMode === 'list' ? (
          <Card padding="none">
            <div className="divide-y divide-[var(--border-primary)]">
              {recurring.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
                  No recurring bills configured yet. Click &ldquo;Add Bill&rdquo; to schedule one.
                </div>
              ) : (
                recurring.map((rec) => {
                  const priceHike =
                    rec.lastAmount !== null &&
                    compareMoney(absMoney(rec.amount), absMoney(rec.lastAmount)) > 0;
                  const recCat = categories.find((c) => c.id === rec.categoryId);
                  return (
                    <div
                      key={rec.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <CategoryIcon
                          icon={recCat?.icon ?? 'Repeat'}
                          label={recCat?.name ?? rec.name}
                          color={recCat?.color ?? '#3b82f6'}
                          variant="circle"
                          size="sm"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{rec.name}</span>
                            <Pill label={rec.cadence} color="#3b82f6" />
                            {priceHike && (
                              <Pill
                                label="Price Hike Detected"
                                color="#f59e0b"
                                icon={<AlertTriangle className="w-3 h-3" />}
                              />
                            )}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" /> Next occurrence: {rec.nextOccurrenceDate}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-bold">
                            <MoneyAmount value={rec.amount} currency={rec.currency} />
                          </div>
                          {rec.lastAmount && (
                            <div className="text-xs text-[var(--text-muted)]">
                              Previous: <MoneyAmount value={rec.lastAmount} currency={rec.currency} />
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          onClick={() => void markRecurringPaid(rec.id)}
                        >
                          Mark Paid
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${rec.name}`}
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => void deleteRecurringBill(rec.id)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        ) : (
          <Card title={`Bills Schedule — ${budgetMonth}`}>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((cell) => (
                <div
                  key={cell.iso}
                  className="min-h-[82px] p-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] flex flex-col justify-between"
                >
                  <div className="text-xs font-mono-tabular font-semibold text-[var(--text-secondary)]">
                    {cell.day}
                  </div>
                  <div className="space-y-1 mt-1">
                    {cell.bills.map((b) => (
                      <div
                        key={b.id}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface)] border border-[var(--border-primary)] truncate"
                        title={`${b.name}: ${b.amount} ${b.currency}`}
                      >
                        {b.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </Section>

      {/* New Goal Dialog */}
      <Dialog
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title="Create Financial Goal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGoalModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!goalName.trim()) return;
                await createGoal({
                  name: goalName.trim(),
                  targetAmount: goalTarget,
                  currentAmount: goalCurrent,
                  monthlyPledge: goalPledge,
                  targetDate: goalTargetDate,
                  color: '#10b981',
                  linkedAccountIds: goalLinkedAccountIds,
                });
                setGoalName('');
                setGoalLinkedAccountIds([]);
                setGoalModalOpen(false);
              }}
            >
              Create Goal
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Goal Name
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g., College 529 Fund, Early Mortgage Payoff"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>
          <MoneyField
            label="Target Amount"
            value={goalTarget}
            onChange={setGoalTarget}
            currency={family.baseCurrency}
          />
          <MoneyField
            label="Current Saved Amount"
            value={goalCurrent}
            onChange={setGoalCurrent}
            currency={family.baseCurrency}
          />
          <MoneyField
            label="Monthly Pledge"
            value={goalPledge}
            onChange={setGoalPledge}
            currency={family.baseCurrency}
          />
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Target Date
            </label>
            <input
              type="date"
              value={goalTargetDate}
              onChange={(e) => setGoalTargetDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>
          {fundableAccounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Linked Funding Accounts (optional — live balance overrides manual saved amount)
              </label>
              <div className="max-h-32 overflow-y-auto rounded-md border border-[var(--border-primary)] divide-y divide-[var(--border-primary)]">
                {fundableAccounts.map((acc) => {
                  const checked = goalLinkedAccountIds.includes(acc.id);
                  return (
                    <label
                      key={acc.id}
                      className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setGoalLinkedAccountIds((prev) =>
                              e.target.checked
                                ? [...prev, acc.id]
                                : prev.filter((id) => id !== acc.id)
                            )
                          }
                        />
                        <span className="font-medium text-[var(--text-primary)]">{acc.name}</span>
                      </span>
                      <MoneyAmount value={acc.balance} currency={acc.currency} />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* New Recurring Bill Dialog */}
      <Dialog
        open={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title="Schedule Recurring Bill or Income"
        description="Automatically advances next due date and records ledger payments on click."
        footer={
          <>
            <Button variant="secondary" onClick={() => setBillModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!billName.trim() || !effectiveBillAccountId) return;
                const targetAccount = accounts.find((a) => a.id === effectiveBillAccountId);
                await createRecurringBill({
                  name: billName.trim(),
                  amount: billAmount,
                  currency: targetAccount?.currency ?? family.baseCurrency,
                  cadence: billCadence,
                  nextOccurrenceDate: billDate,
                  accountId: effectiveBillAccountId,
                  categoryId: billCategoryId || null,
                  autoPay: true,
                });
                setBillName('');
                setBillModalOpen(false);
              }}
            >
              Save Bill
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Bill / Subscription Name
            </label>
            <input
              type="text"
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              placeholder="e.g., AWS Cloud, City Fiber Internet, Bi-Weekly Paycheck"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyField
              label="Amount (negative = bill)"
              value={billAmount}
              onChange={setBillAmount}
              currency={
                accounts.find((a) => a.id === effectiveBillAccountId)?.currency ??
                family.baseCurrency
              }
            />
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Cadence
              </label>
              <select
                value={billCadence}
                onChange={(e) => setBillCadence(e.target.value as RecurringCadence)}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="WEEKLY">WEEKLY</option>
                <option value="BIWEEKLY">BIWEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="QUARTERLY">QUARTERLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Account
              </label>
              <select
                value={effectiveBillAccountId}
                onChange={(e) => setBillAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Next Occurrence
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Category (Optional)
            </label>
            <select
              value={billCategoryId}
              onChange={(e) => setBillCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
