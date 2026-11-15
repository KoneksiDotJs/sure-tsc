import React, { useMemo, useState } from 'react';
import { compareMoney, divMoney, mulMoney, subMoney } from '@sure/shared';
import { Button, Card, Dialog, MoneyAmount, MoneyField, Pill, ProgressRing, Section } from '@sure/ui';
import { Plus, Target, Trash2 } from 'lucide-react';
import type { LedgerContextValue, WebAccount, WebGoal } from '../../../lib/ledger-context.js';

interface FinancialGoalsSectionProps {
  baseCurrency: string;
  accounts: WebAccount[];
  goals: WebGoal[];
  onCreateGoal: LedgerContextValue['createGoal'];
  onDeleteGoal: (id: string) => Promise<void>;
}

export const FinancialGoalsSection: React.FC<FinancialGoalsSectionProps> = ({
  baseCurrency,
  accounts,
  goals,
  onCreateGoal,
  onDeleteGoal,
}) => {
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

  return (
    <>
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
                      onClick={() => void onDeleteGoal(g.id)}
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
                      <MoneyAmount value={g.currentAmount} currency={baseCurrency} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-secondary)]">Target Goal</div>
                    <div className="font-bold mt-0.5">
                      <MoneyAmount value={g.targetAmount} currency={baseCurrency} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-secondary)]">Remaining</div>
                    <div className="font-bold mt-0.5">
                      <MoneyAmount value={remaining} currency={baseCurrency} />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

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
                await onCreateGoal({
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
            currency={baseCurrency}
          />
          <MoneyField
            label="Current Saved Amount"
            value={goalCurrent}
            onChange={setGoalCurrent}
            currency={baseCurrency}
          />
          <MoneyField
            label="Monthly Pledge"
            value={goalPledge}
            onChange={setGoalPledge}
            currency={baseCurrency}
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
    </>
  );
};
