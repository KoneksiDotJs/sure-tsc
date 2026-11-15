import React, { useEffect, useState } from 'react';
import { compareMoney } from '@sure/shared';
import { Button, Dialog, MoneyField, SegmentedControl } from '@sure/ui';
import type { WebAccount, WebEntry, WebTransferSuggestion } from '../../../lib/ledger-context.js';

interface TransferMatchDialogProps {
  open: boolean;
  onClose: () => void;
  baseCurrency: string;
  accounts: WebAccount[];
  entries: WebEntry[];
  fetchTransferSuggestions: () => Promise<WebTransferSuggestion[]>;
  onCreateTransfer: (input: {
    fromAccountId: string;
    toAccountId: string;
    date: string;
    amount: string;
    name?: string;
  }) => Promise<void>;
  onMatchTransfer: (outflowEntryId: string, inflowEntryId: string) => Promise<void>;
}

export const TransferMatchDialog: React.FC<TransferMatchDialogProps> = ({
  open,
  onClose,
  baseCurrency,
  accounts,
  entries,
  fetchTransferSuggestions,
  onCreateTransfer,
  onMatchTransfer,
}) => {
  const [transferMode, setTransferMode] = useState<'NEW' | 'MATCH'>('NEW');
  const [transferFromAccountId, setTransferFromAccountId] = useState(accounts[0]?.id ?? '');
  const [transferToAccountId, setTransferToAccountId] = useState(accounts[1]?.id ?? '');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferAmount, setTransferAmount] = useState('250.0000');
  const [transferName, setTransferName] = useState('');
  const [outflowId, setOutflowId] = useState('');
  const [inflowId, setInflowId] = useState('');
  const [transferSuggestions, setTransferSuggestions] = useState<WebTransferSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const effectiveFromAccountId = accounts.some((a) => a.id === transferFromAccountId)
    ? transferFromAccountId
    : (accounts[0]?.id ?? '');
  const effectiveToAccountId = accounts.some(
    (a) => a.id === transferToAccountId && a.id !== effectiveFromAccountId
  )
    ? transferToAccountId
    : (accounts.find((a) => a.id !== effectiveFromAccountId)?.id ?? '');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSuggestionsLoading(true);
    void fetchTransferSuggestions()
      .then((list) => {
        if (cancelled) return;
        setTransferSuggestions(list);
        if (list.length > 0) setTransferMode('MATCH');
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchTransferSuggestions]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Internal Transfer Between Family Accounts"
      description="Create a new paired transfer or link existing outflow/inflow entries (`TransferMatch`)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {transferMode === 'NEW' ? (
            <Button
              disabled={
                !effectiveFromAccountId ||
                !effectiveToAccountId ||
                effectiveFromAccountId === effectiveToAccountId ||
                compareMoney(transferAmount, '0.0000') <= 0
              }
              onClick={async () => {
                await onCreateTransfer({
                  fromAccountId: effectiveFromAccountId,
                  toAccountId: effectiveToAccountId,
                  date: transferDate,
                  amount: transferAmount,
                  ...(transferName.trim() ? { name: transferName.trim() } : {}),
                });
                setTransferName('');
                onClose();
              }}
            >
              Create Transfer
            </Button>
          ) : (
            <Button
              disabled={!outflowId || !inflowId}
              onClick={async () => {
                if (outflowId && inflowId) {
                  await onMatchTransfer(outflowId, inflowId);
                  onClose();
                }
              }}
            >
              Link Transfer
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          value={transferMode}
          onChange={setTransferMode}
          options={[
            { value: 'NEW', label: 'New Transfer' },
            {
              value: 'MATCH',
              label:
                transferSuggestions.length > 0
                  ? `Link Existing (${transferSuggestions.length})`
                  : 'Link Existing',
            },
          ]}
        />

        {transferMode === 'NEW' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  From Account
                </label>
                <select
                  value={effectiveFromAccountId}
                  onChange={(e) => setTransferFromAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  To Account
                </label>
                <select
                  value={effectiveToAccountId}
                  onChange={(e) => setTransferToAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                >
                  {accounts
                    .filter((a) => a.id !== effectiveFromAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>
              <MoneyField
                label="Transfer Amount"
                value={transferAmount}
                onChange={setTransferAmount}
                currency={
                  accounts.find((a) => a.id === effectiveFromAccountId)?.currency ?? baseCurrency
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={transferName}
                onChange={(e) => setTransferName(e.target.value)}
                placeholder="e.g., Credit card payment or savings transfer"
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestionsLoading && (
              <div className="text-xs text-[var(--text-secondary)]">
                Scanning ledger for potential transfer pairs...
              </div>
            )}
            {!suggestionsLoading && transferSuggestions.length > 0 && (
              <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] space-y-2">
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  Suggested Transfer Pairs ({transferSuggestions.length})
                </div>
                <div className="divide-y divide-[var(--border-primary)]">
                  {transferSuggestions.map((s) => (
                    <div
                      key={`${s.outflowEntryId}:${s.inflowEntryId}`}
                      className="py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {s.outflowAccountName} → {s.inflowAccountName}
                        </div>
                        <div className="text-[var(--text-secondary)] truncate">
                          {s.outflowDate} ({s.outflowName}) ↔ {s.inflowDate} ({s.inflowName})
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-tabular font-semibold">{s.amount}</span>
                        <Button
                          size="sm"
                          onClick={() => {
                            void onMatchTransfer(s.outflowEntryId, s.inflowEntryId);
                            setTransferSuggestions((prev) =>
                              prev.filter(
                                (p) =>
                                  p.outflowEntryId !== s.outflowEntryId &&
                                  p.inflowEntryId !== s.inflowEntryId
                              )
                            );
                          }}
                        >
                          Match Pair
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Outflow Entry
              </label>
              <select
                value={outflowId}
                onChange={(e) => setOutflowId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="">Select outflow transaction...</option>
                {entries
                  .filter((e) => compareMoney(e.amount, '0.0000') < 0)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.date} — {e.name} ({e.amount})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Inflow Entry
              </label>
              <select
                value={inflowId}
                onChange={(e) => setInflowId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="">Select inflow transaction...</option>
                {entries
                  .filter((e) => compareMoney(e.amount, '0.0000') > 0)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.date} — {e.name} (+{e.amount})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
