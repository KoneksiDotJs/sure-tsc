import React, { useMemo, useState } from 'react';
import { RecurringCadence, absMoney, compareMoney } from '@sure/shared';
import { Alert, Button, MoneyAmount } from '@sure/ui';
import { Search, Trash2 } from 'lucide-react';
import { useLedger } from '../../../lib/ledger-context.js';

interface DetectedPattern {
  key: string;
  name: string;
  amount: string;
  currency: string;
  accountId: string;
  categoryId: string | null;
  count: number;
  latestDate: string;
  isIncome: boolean;
}

export const RecurringSection: React.FC = () => {
  const {
    entries,
    recurring,
    createRecurringBill,
    markRecurringPaid,
    deleteRecurringBill,
  } = useLedger();

  const [dismissedPatterns, setDismissedPatterns] = useState<Record<string, boolean>>({});
  const [patternScanNotice, setPatternScanNotice] = useState<string | null>(null);

  const detectedPatterns = useMemo<DetectedPattern[]>(() => {
    const existingNames = new Set(recurring.map((r) => r.name.trim().toLowerCase()));
    const groups = new Map<string, DetectedPattern>();

    for (const e of entries) {
      if (e.entryType !== 'TRANSACTION') continue;
      const key = e.name.trim().toLowerCase();
      if (!key || existingNames.has(key)) continue;
      const cur = groups.get(key);
      if (!cur) {
        groups.set(key, {
          key,
          name: e.name.trim(),
          amount: absMoney(e.amount),
          currency: e.currency,
          accountId: e.accountId,
          categoryId: e.categoryId,
          count: 1,
          latestDate: e.date.slice(0, 10),
          isIncome: compareMoney(e.amount, '0') > 0,
        });
      } else {
        cur.count += 1;
        if (e.date.slice(0, 10) > cur.latestDate) {
          cur.latestDate = e.date.slice(0, 10);
          cur.amount = absMoney(e.amount);
        }
      }
    }

    return Array.from(groups.values())
      .filter((g) => g.count >= 2 && !dismissedPatterns[g.key])
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [entries, recurring, dismissedPatterns]);

  return (
    <div className="space-y-5">
      {patternScanNotice && (
        <Alert variant="info" title="Pattern Scan Complete">
          {patternScanNotice}
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[var(--text-secondary)]">
          Manage detected recurring expenses and income schedules across your accounts.
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Search className="w-3.5 h-3.5" />}
          onClick={() =>
            setPatternScanNotice(
              `Scanned ${entries.length} ledger entries: found ${detectedPatterns.length} candidate repeating payee pattern(s) and ${recurring.length} active schedule(s).`
            )
          }
        >
          Identify Patterns
        </Button>
      </div>

      {/* Configured Recurring Items */}
      <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          CONFIGURED RECURRING <span className="mx-1">•</span> {recurring.length}
        </div>
        {recurring.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
            No recurring bills or income schedules configured yet. Add one from the detected patterns below.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {recurring.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{r.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    <MoneyAmount value={r.amount} currency={r.currency} /> • {r.cadence} • Next:{' '}
                    {r.nextOccurrenceDate}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void markRecurringPaid(r.id)}
                  >
                    Mark Paid
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete recurring ${r.name}`}
                    onClick={() => void deleteRecurringBill(r.id)}
                    className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--status-negative)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Possible New Patterns Detected from Entries */}
      <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          POSSIBLE NEW PATTERNS <span className="mx-1">•</span> {detectedPatterns.length}
        </div>
        {detectedPatterns.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
            No new repeating transaction patterns found in your current ledger.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {detectedPatterns.map((p) => (
              <div
                key={p.key}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{p.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    <MoneyAmount value={p.amount} currency={p.currency} /> • Monthly • seen{' '}
                    {p.count} times
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void createRecurringBill({
                        name: p.name,
                        amount: p.amount,
                        currency: p.currency,
                        cadence: 'MONTHLY' as RecurringCadence,
                        nextOccurrenceDate: p.latestDate,
                        accountId: p.accountId,
                        categoryId: p.categoryId,
                      })
                    }
                  >
                    {p.isIncome ? 'Add income' : 'Add bill'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDismissedPatterns((prev) => ({ ...prev, [p.key]: true }))
                    }
                  >
                    {p.isIncome ? 'Not income' : 'Not a bill'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
