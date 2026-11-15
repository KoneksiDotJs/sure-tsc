import React, { useState } from 'react';
import type { EntryType } from '@sure/shared';
import { Button, CategorySelect, Dialog, MoneyField, SegmentedControl } from '@sure/ui';
import type { LedgerContextValue, WebAccount, WebCategory } from '../../../lib/ledger-context.js';

interface CreateEntryDialogProps {
  open: boolean;
  onClose: () => void;
  baseCurrency: string;
  accounts: WebAccount[];
  categories: WebCategory[];
  onCreateEntry: LedgerContextValue['createEntry'];
}

export const CreateEntryDialog: React.FC<CreateEntryDialogProps> = ({
  open,
  onClose,
  baseCurrency,
  accounts,
  categories,
  onCreateEntry,
}) => {
  const [newEntryType, setNewEntryType] = useState<EntryType>('TRANSACTION');
  const [newAccountId, setNewAccountId] = useState(accounts[0]?.id ?? '');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('-85.0000');
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);
  const [tradeTicker, setTradeTicker] = useState('VTI');
  const [tradeSecurityName, setTradeSecurityName] = useState('Vanguard Total Stock Market ETF');
  const [tradeAction, setTradeAction] = useState<'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT'>('BUY');
  const [tradeQty, setTradeQty] = useState('1.0000');
  const [tradePrice, setTradePrice] = useState('275.0000');

  const effectiveAccountId = accounts.some((a) => a.id === newAccountId)
    ? newAccountId
    : (accounts[0]?.id ?? '');
  const effectiveCategoryId = categories.some((c) => c.id === newCategoryId)
    ? newCategoryId
    : (categories.find((c) => c.classification === 'EXPENSE')?.id ?? null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record Polymorphic Ledger Entry"
      description="Creates a TRANSACTION, VALUATION, or TRADE and triggers BalanceService materialization."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!newName.trim() || !effectiveAccountId) return;
              const targetAccount = accounts.find((a) => a.id === effectiveAccountId);
              await onCreateEntry({
                accountId: effectiveAccountId,
                entryType: newEntryType,
                date: newDate,
                amount: newAmount,
                currency: targetAccount?.currency ?? baseCurrency,
                name: newName.trim(),
                categoryId: newEntryType === 'TRANSACTION' ? effectiveCategoryId : null,
                merchantId: null,
                tagIds: [],
                notes: 'Manual ledger entry',
                excluded: newEntryType === 'VALUATION',
                ...(newEntryType === 'VALUATION' ? { valuationKind: 'RECONCILIATION' } : {}),
                ...(newEntryType === 'TRADE'
                  ? {
                      tradeDetails: {
                        securityTicker: tradeTicker.trim().toUpperCase() || 'VTI',
                        securityName: tradeSecurityName.trim() || newName.trim(),
                        tradeAction,
                        qty: tradeQty,
                        price: tradePrice,
                        fees: '0.0000',
                      },
                    }
                  : {}),
              });
              setNewName('');
              onClose();
            }}
          >
            Save Entry
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SegmentedControl<EntryType>
          options={[
            { value: 'TRANSACTION', label: 'Transaction' },
            { value: 'VALUATION', label: 'Valuation Anchor' },
            { value: 'TRADE', label: 'Security Trade' },
          ]}
          value={newEntryType}
          onChange={setNewEntryType}
        />

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Target Account
          </label>
          <select
            value={effectiveAccountId}
            onChange={(e) => setNewAccountId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.accountType})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>
          <MoneyField
            label="Amount (Inline math e.g. -45.50 * 2)"
            value={newAmount}
            onChange={setNewAmount}
            currency={
              accounts.find((a) => a.id === effectiveAccountId)?.currency ?? baseCurrency
            }
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Description
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Trader Joe's, Monthly Rent, AAPL Stock Purchase"
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
          />
        </div>

        {newEntryType === 'TRANSACTION' && (
          <CategorySelect
            label="Category"
            options={categories}
            value={effectiveCategoryId}
            onChange={setNewCategoryId}
          />
        )}

        {newEntryType === 'TRADE' && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Ticker
              </label>
              <input
                type="text"
                value={tradeTicker}
                onChange={(e) => setTradeTicker(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Trade Action
              </label>
              <select
                value={tradeAction}
                onChange={(e) =>
                  setTradeAction(e.target.value as 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT')
                }
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="DIVIDEND">DIVIDEND</option>
                <option value="SPLIT">SPLIT</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Security Name
              </label>
              <input
                type="text"
                value={tradeSecurityName}
                onChange={(e) => setTradeSecurityName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Quantity
              </label>
              <input
                type="text"
                value={tradeQty}
                onChange={(e) => setTradeQty(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Price per Unit
              </label>
              <input
                type="text"
                value={tradePrice}
                onChange={(e) => setTradePrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
