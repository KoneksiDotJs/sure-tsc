import { ArrowLeftRight, Lock, Scale, Shapes, TrendingUp } from 'lucide-react';
import { CategoryIcon, DataTableColumn, MoneyAmount, Pill } from '@sure/ui';
import type { WebAccount, WebCategory, WebEntry, WebMerchant } from '../../../lib/ledger-context.js';

export function exportEntriesToCsv(
  filteredEntries: WebEntry[],
  accounts: WebAccount[],
  categories: WebCategory[]
): void {
  const csvEscape = (val: string) => `"${val.replaceAll('"', '""')}"`;
  const header = ['date', 'account', 'name', 'entryType', 'category', 'amount', 'currency', 'notes'];
  const lines = [
    header.join(','),
    ...filteredEntries.map((entry) => {
      const acctName = accounts.find((a) => a.id === entry.accountId)?.name ?? entry.accountId;
      const catName = categories.find((c) => c.id === entry.categoryId)?.name ?? '';
      return [
        csvEscape(entry.date),
        csvEscape(acctName),
        csvEscape(entry.name),
        csvEscape(entry.entryType),
        csvEscape(catName),
        csvEscape(entry.amount),
        csvEscape(entry.currency),
        csvEscape(entry.notes ?? ''),
      ].join(',');
    }),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sure-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildTransactionColumns(
  accounts: WebAccount[],
  categories: WebCategory[],
  merchants: WebMerchant[]
): DataTableColumn<WebEntry>[] {
  return [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (row) => row.date,
      render: (row) => (
        <span className="font-mono-tabular text-xs text-[var(--text-secondary)]">
          {row.date}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Transaction',
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => {
        const merch = merchants.find((m) => m.id === row.merchantId);
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] shrink-0">
              {(row.name[0] ?? 'T').toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                <span className="truncate">{row.name}</span>
                {row.splits.length > 0 && (
                  <Pill label={`${row.splits.length} Splits`} color="#8b5cf6" />
                )}
                {row.transferMatchId && (
                  <Pill
                    label="Paired Transfer"
                    color="#3b82f6"
                    icon={<ArrowLeftRight className="w-3 h-3" />}
                  />
                )}
                {row.excluded && <Pill label="Excluded" color="#6b7280" />}
              </div>
              <div className="text-xs text-[var(--text-secondary)] truncate">
                {merch ? merch.name : row.notes || 'Polymorphic Ledger Entry'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => {
        if (row.entryType === 'VALUATION') {
          return (
            <Pill
              label={`VALUATION (${row.valuationKind ?? 'ANCHOR'})`}
              color="#8b5cf6"
              icon={<Scale className="w-3 h-3" />}
            />
          );
        }
        if (row.entryType === 'TRADE') {
          return (
            <Pill
              label={`TRADE: ${row.tradeDetails?.tradeAction} ${row.tradeDetails?.securityTicker}`}
              color="#10b981"
              icon={<TrendingUp className="w-3 h-3" />}
            />
          );
        }
        if (row.transferMatchId) {
          return (
            <Pill
              label="Transfer"
              color="#3b82f6"
              icon={<ArrowLeftRight className="w-3 h-3" />}
            />
          );
        }
        const cat = categories.find((c) => c.id === row.categoryId);
        return cat ? (
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
          />
        ) : (
          <Pill
            label="Uncategorized"
            color="#f59e0b"
            icon={<Shapes className="w-3 h-3" />}
          />
        );
      },
    },
    {
      key: 'account',
      header: 'Account',
      render: (row) => {
        const acc = accounts.find((a) => a.id === row.accountId);
        return (
          <span className="text-xs text-[var(--text-secondary)]">
            {acc?.name ?? row.accountId}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      sortValue: (row) => Number(row.amount),
      render: (row) => (
        <span className="inline-flex items-center gap-1.5">
          {(row.importId || row.transferMatchId) && (
            <Lock className="w-3 h-3 text-[var(--text-muted)]" />
          )}
          <MoneyAmount
            value={row.amount}
            currency={row.currency}
            colorize={row.entryType === 'TRANSACTION'}
            showSign={row.entryType === 'TRANSACTION'}
            className="font-semibold"
          />
        </span>
      ),
    },
  ];
}
