import React, { useEffect, useState } from 'react';
import { compareMoney, subMoney, sumMoney } from '@sure/shared';
import { Button, Dialog, MoneyField } from '@sure/ui';
import type { WebEntry, WebSplitItem } from '../../../lib/ledger-context.js';

interface SplitTransactionDialogProps {
  open: boolean;
  onClose: () => void;
  activeEntry: WebEntry | null;
  baseCurrency: string;
  onSaveSplits: (entryId: string, splits: WebSplitItem[]) => Promise<void> | void;
}

export const SplitTransactionDialog: React.FC<SplitTransactionDialogProps> = ({
  open,
  onClose,
  activeEntry,
  baseCurrency,
  onSaveSplits,
}) => {
  const [splitRows, setSplitRows] = useState<WebSplitItem[]>([]);

  useEffect(() => {
    if (!open || !activeEntry) return;
    if (activeEntry.splits.length >= 2) {
      setSplitRows(activeEntry.splits);
    } else {
      const half = subMoney(activeEntry.amount, '0.0000');
      setSplitRows([
        {
          id: 'sp-1',
          name: `${activeEntry.name} (Part 1)`,
          amount: half,
          categoryId: activeEntry.categoryId,
        },
        {
          id: 'sp-2',
          name: `${activeEntry.name} (Part 2)`,
          amount: '0.0000',
          categoryId: null,
        },
      ]);
    }
  }, [open, activeEntry]);

  const splitTotal = sumMoney(splitRows.map((s) => s.amount));
  const splitRemaining = activeEntry ? subMoney(activeEntry.amount, splitTotal) : '0.0000';
  const isSplitValid = activeEntry !== null && compareMoney(splitTotal, activeEntry.amount) === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Split Transaction Across Categories"
      description={`Parent Transaction Total: ${activeEntry?.amount ?? '0.0000'} USD`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!isSplitValid}
            onClick={() => {
              if (activeEntry && isSplitValid) {
                void onSaveSplits(activeEntry.id, splitRows);
                onClose();
              }
            }}
          >
            Save Splits
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {splitRows.map((row, idx) => (
          <div
            key={row.id}
            className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] space-y-2"
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => {
                const next = [...splitRows];
                next[idx] = { ...row, name: e.target.value };
                setSplitRows(next);
              }}
              className="w-full px-2.5 py-1.5 text-sm rounded bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
            <MoneyField
              label="Split Portion Amount"
              value={row.amount}
              currency={activeEntry?.currency ?? baseCurrency}
              onChange={(amount) => {
                const next = [...splitRows];
                next[idx] = { ...row, amount };
                setSplitRows(next);
              }}
            />
          </div>
        ))}
        <div className="flex items-center justify-between text-xs font-mono-tabular pt-2">
          <span>Remaining Unallocated: {splitRemaining}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSplitRows([
                ...splitRows,
                {
                  id: `sp-${Date.now()}`,
                  name: 'Additional Split',
                  amount: splitRemaining,
                  categoryId: null,
                },
              ])
            }
          >
            + Add Split Row
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
