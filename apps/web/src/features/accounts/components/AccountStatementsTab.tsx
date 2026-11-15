import React, { useMemo } from 'react';
import { absMoney, addMoney, compareMoney } from '@sure/shared';
import { Button, Card, DetailRow, EmptyState, MoneyAmount } from '@sure/ui';
import { Calendar, Scale } from 'lucide-react';
import { WebAccount, WebEntry } from '../../../lib/ledger-context.js';
import { GROUP_LABELS } from './accountHistory.js';

export const AccountStatementsTab: React.FC<{
  activeAccount: WebAccount;
  accountEntries: WebEntry[];
  onOpenReconcile: () => void;
}> = ({ activeAccount, accountEntries, onOpenReconcile }) => {
  const monthlyStatements = useMemo(() => {
    const byMonth = new Map<
      string,
      { month: string; count: number; inflows: string; outflows: string; net: string }
    >();
    for (const e of accountEntries) {
      const m = e.date.slice(0, 7);
      const cur = byMonth.get(m) ?? {
        month: m,
        count: 0,
        inflows: '0.0000',
        outflows: '0.0000',
        net: '0.0000',
      };
      cur.count += 1;
      if (e.entryType === 'TRANSACTION') {
        if (compareMoney(e.amount, '0') > 0) {
          cur.inflows = addMoney(cur.inflows, e.amount);
        } else {
          cur.outflows = addMoney(cur.outflows, absMoney(e.amount));
        }
        cur.net = addMoney(cur.net, e.amount);
      }
      byMonth.set(m, cur);
    }
    return Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [accountEntries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card
        title="Monthly Statements"
        subtitle={`Aggregated ledger periods for ${activeAccount.name}`}
        className="lg:col-span-2"
      >
        {monthlyStatements.length === 0 ? (
          <EmptyState
            title="No statement periods yet"
            description="Add transactions or valuations to materialize monthly statements."
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={<Scale className="w-3.5 h-3.5" />}
                onClick={onOpenReconcile}
              >
                Reconcile Anchor
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {monthlyStatements.map((st) => (
              <div
                key={st.month}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{st.month}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {st.count} {st.count === 1 ? 'entry' : 'entries'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-xs">
                  <div className="text-right">
                    <div className="text-[var(--text-muted)]">Inflows</div>
                    <div className="font-medium text-[var(--status-positive)]">
                      <MoneyAmount value={st.inflows} currency={activeAccount.currency} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--text-muted)]">Outflows</div>
                    <div className="font-medium text-[var(--text-primary)]">
                      <MoneyAmount value={st.outflows} currency={activeAccount.currency} />
                    </div>
                  </div>
                  <div className="text-right min-w-[90px]">
                    <div className="text-[var(--text-muted)]">Net Change</div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      <MoneyAmount
                        value={st.net}
                        currency={activeAccount.currency}
                        showSign
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Account Details" subtitle="Classification & subtype attributes">
        <div className="divide-y divide-[var(--border-primary)]">
          <DetailRow
            label="Classification"
            value={GROUP_LABELS[activeAccount.accountType] || activeAccount.accountType}
          />
          <DetailRow label="Balance Side" value={activeAccount.classification} />
          <DetailRow label="Currency" value={activeAccount.currency} />
          <DetailRow label="Total Entries" value={String(accountEntries.length)} />
          {Object.entries(activeAccount.subtypeDetails ?? {}).map(([k, v]) => (
            <DetailRow
              key={k}
              label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              value={String(v)}
            />
          ))}
        </div>
        <div className="pt-4 mt-2 border-t border-[var(--border-primary)] flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Scale className="w-3.5 h-3.5" />}
            onClick={onOpenReconcile}
          >
            Anchor Balance Valuation
          </Button>
        </div>
      </Card>
    </div>
  );
};
