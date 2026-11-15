import React, { useMemo, useState } from 'react';
import { RecurringCadence, absMoney, compareMoney } from '@sure/shared';
import {
  Button,
  Card,
  CategoryIcon,
  Dialog,
  MoneyAmount,
  MoneyField,
  Pill,
  Section,
  SegmentedControl,
} from '@sure/ui';
import { AlertTriangle, Calendar, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type {
  LedgerContextValue,
  WebAccount,
  WebCategory,
  WebRecurring,
} from '../../../lib/ledger-context.js';

interface RecurringBillsSectionProps {
  baseCurrency: string;
  budgetMonth: string;
  accounts: WebAccount[];
  categories: WebCategory[];
  recurring: WebRecurring[];
  onCreateRecurringBill: LedgerContextValue['createRecurringBill'];
  onMarkRecurringPaid: (id: string) => Promise<void>;
  onDeleteRecurringBill: (id: string) => Promise<void>;
}

export const RecurringBillsSection: React.FC<RecurringBillsSectionProps> = ({
  baseCurrency,
  budgetMonth,
  accounts,
  categories,
  recurring,
  onCreateRecurringBill,
  onMarkRecurringPaid,
  onDeleteRecurringBill,
}) => {
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

  const calendarDays = useMemo(() => {
    const [yearStr = '2026', monthStr = '11'] = budgetMonth.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const days: Array<{
      day: number;
      iso: string;
      bills: WebRecurring[];
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${budgetMonth}-${String(d).padStart(2, '0')}`;
      const bills = recurring.filter((r) => {
        if (r.nextOccurrenceDate === iso) return true;
        if (
          r.cadence === 'MONTHLY' &&
          r.nextOccurrenceDate.endsWith(`-${String(d).padStart(2, '0')}`)
        ) {
          return true;
        }
        return false;
      });
      days.push({ day: d, iso, bills });
    }
    return days;
  }, [budgetMonth, recurring]);

  return (
    <>
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
                          onClick={() => void onMarkRecurringPaid(rec.id)}
                        >
                          Mark Paid
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${rec.name}`}
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => void onDeleteRecurringBill(rec.id)}
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
                await onCreateRecurringBill({
                  name: billName.trim(),
                  amount: billAmount,
                  currency: targetAccount?.currency ?? baseCurrency,
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
                accounts.find((a) => a.id === effectiveBillAccountId)?.currency ?? baseCurrency
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
    </>
  );
};
