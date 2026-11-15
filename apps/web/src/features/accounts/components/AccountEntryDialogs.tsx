import React, { useEffect, useState } from 'react';
import { AccountType, EntryType, formatCurrency } from '@sure/shared';
import {
  Button,
  CategorySelect,
  Dialog,
  Disclosure,
  IconPicker,
  MerchantSelect,
  MoneyField,
  SlideOverDrawer,
  TagSelect,
  Toggle,
} from '@sure/ui';
import { Trash2 } from 'lucide-react';
import { useLedger, WebAccount, WebEntry } from '../../../lib/ledger-context.js';
import {
  ACCOUNT_TYPES,
  formatInspectorDate,
  GROUP_LABELS,
} from './accountHistory.js';

export const EntryInspectorDrawer: React.FC<{
  inspectingEntry: WebEntry | null;
  onClose: () => void;
}> = ({ inspectingEntry, onClose }) => {
  const {
    categories,
    merchants,
    tags,
    updateEntry,
    deleteEntries,
    createCategory,
    createMerchant,
    createTag,
  } = useLedger();

  const [draftName, setDraftName] = useState<string>('');
  const [draftDate, setDraftDate] = useState<string>('');
  const [draftType, setDraftType] = useState<EntryType>('TRANSACTION');
  const [draftAmount, setDraftAmount] = useState<string>('0.00');
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);
  const [draftMerchantId, setDraftMerchantId] = useState<string | null>(null);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [draftExcluded, setDraftExcluded] = useState<boolean>(false);

  useEffect(() => {
    if (!inspectingEntry) return;
    setDraftName(inspectingEntry.name);
    setDraftDate(inspectingEntry.date.slice(0, 10));
    setDraftType(inspectingEntry.entryType);
    setDraftAmount(inspectingEntry.amount);
    setDraftCategoryId(inspectingEntry.categoryId);
    setDraftMerchantId(inspectingEntry.merchantId);
    setDraftTagIds(inspectingEntry.tagIds);
    setDraftNotes(inspectingEntry.notes);
    setDraftExcluded(inspectingEntry.excluded);
  }, [inspectingEntry]);

  const handleSaveInspection = async () => {
    if (!inspectingEntry) return;
    await updateEntry(inspectingEntry.id, {
      name: draftName.trim() || inspectingEntry.name,
      date: draftDate || inspectingEntry.date.slice(0, 10),
      entryType: draftType,
      amount: draftAmount,
      categoryId: draftCategoryId,
      merchantId: draftMerchantId,
      tagIds: draftTagIds,
      notes: draftNotes,
      excluded: draftExcluded,
    });
    onClose();
  };

  return (
    <SlideOverDrawer
      open={Boolean(inspectingEntry)}
      onClose={onClose}
      title={
        inspectingEntry
          ? `${formatCurrency(draftAmount || inspectingEntry.amount, inspectingEntry.currency)} ${inspectingEntry.currency}`
          : 'Entry Details'
      }
      subtitle={inspectingEntry ? formatInspectorDate(draftDate || inspectingEntry.date) : ''}
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <Button
            variant="destructive"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => {
              if (inspectingEntry) {
                void deleteEntries([inspectingEntry.id]);
                onClose();
              }
            }}
          >
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSaveInspection()}>
              Save Changes
            </Button>
          </div>
        </div>
      }
    >
      {inspectingEntry && (
        <div className="space-y-3">
          <Disclosure title="OVERVIEW" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Type
                  </label>
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as EntryType)}
                    className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                  >
                    <option value="TRANSACTION">Transaction</option>
                    <option value="VALUATION">Valuation</option>
                    <option value="TRADE">Trade</option>
                  </select>
                </div>

                <MoneyField
                  label="Amount"
                  value={draftAmount}
                  onChange={setDraftAmount}
                  currency={inspectingEntry.currency}
                />
              </div>

              <CategorySelect
                label="Category"
                options={categories}
                value={draftCategoryId}
                onChange={setDraftCategoryId}
                onCreateNew={(name) => {
                  void createCategory(name, 'EXPENSE');
                }}
              />
            </div>
          </Disclosure>

          <Disclosure title="DETAILS" defaultOpen={false}>
            <div className="space-y-3">
              <MerchantSelect
                label="Merchant"
                options={merchants}
                value={draftMerchantId}
                onChange={setDraftMerchantId}
                onCreateNew={(name) => {
                  void createMerchant(name);
                }}
              />

              <TagSelect
                label="Tags"
                options={tags}
                selectedIds={draftTagIds}
                onChange={setDraftTagIds}
                onCreateNew={(name) => {
                  void createTag(name);
                }}
              />

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Add memo, receipt details, or reconciliation context..."
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                />
              </div>
            </div>
          </Disclosure>

          <Disclosure title="SETTINGS" defaultOpen={false}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    Exclude from Cash Flow & Budgets
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Keep in account balance history without affecting expense or income totals.
                  </div>
                </div>
                <Toggle checked={draftExcluded} onChange={setDraftExcluded} />
              </div>
            </div>
          </Disclosure>
        </div>
      )}
    </SlideOverDrawer>
  );
};

export const NewAccountEntryDialog: React.FC<{
  activeAccount: WebAccount;
  open: boolean;
  onClose: () => void;
}> = ({ activeAccount, open, onClose }) => {
  const { categories, createEntry, createCategory } = useLedger();

  const [entryName, setEntryName] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [entryType, setEntryType] = useState<EntryType>('TRANSACTION');
  const [entryAmount, setEntryAmount] = useState<string>('-45.00');
  const [entryCategoryId, setEntryCategoryId] = useState<string | null>(null);

  const handleCreateAccountEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryName.trim()) return;
    await createEntry({
      accountId: activeAccount.id,
      entryType,
      date: entryDate,
      amount: entryAmount,
      currency: activeAccount.currency,
      name: entryName.trim(),
      categoryId: entryCategoryId,
      merchantId: null,
      tagIds: [],
      notes: '',
      excluded: false,
    });
    setEntryName('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`New Entry — ${activeAccount.name}`}
      description="Creates a ledger entry and materializes updated daily account balances."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateAccountEntry}>Create Entry</Button>
        </>
      }
    >
      <form onSubmit={handleCreateAccountEntry} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Description / Merchant Name
          </label>
          <input
            type="text"
            required
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
            placeholder="e.g., Monthly Transfer, Whole Foods, Dividend"
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Entry Type
            </label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as EntryType)}
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            >
              <option value="TRANSACTION">TRANSACTION</option>
              <option value="VALUATION">VALUATION</option>
              <option value="TRADE">TRADE</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            />
          </div>
        </div>

        <MoneyField
          label="Amount (Negative for expense/outflow, positive for income/inflow)"
          value={entryAmount}
          onChange={setEntryAmount}
          currency={activeAccount.currency}
        />

        <CategorySelect
          label="Category"
          options={categories}
          value={entryCategoryId}
          onChange={setEntryCategoryId}
          onCreateNew={(name) => {
            void createCategory(name, 'EXPENSE');
          }}
        />
      </form>
    </Dialog>
  );
};

export const ReconcileBalanceDialog: React.FC<{
  activeAccount: WebAccount;
  open: boolean;
  onClose: () => void;
}> = ({ activeAccount, open, onClose }) => {
  const { createEntry } = useLedger();
  const [reconciledBalance, setReconciledBalance] = useState<string>(activeAccount.balance);

  useEffect(() => {
    if (open) setReconciledBalance(activeAccount.balance);
  }, [open, activeAccount.balance]);

  const handleCommitReconciliation = async () => {
    await createEntry({
      accountId: activeAccount.id,
      entryType: 'VALUATION',
      date: new Date().toISOString().slice(0, 10),
      amount: reconciledBalance,
      currency: activeAccount.currency,
      name: 'Manual Balance Reconciliation',
      categoryId: null,
      merchantId: null,
      tagIds: [],
      notes: 'Anchored via Account Detail Reconciler',
      excluded: false,
      valuationKind: 'RECONCILIATION',
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Reconcile Balance Valuation — ${activeAccount.name}`}
      description="Creates a RECONCILIATION Valuation entry and anchors daily snapshots."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleCommitReconciliation()}>Anchor Valuation</Button>
        </>
      }
    >
      <div className="space-y-4">
        <MoneyField
          label="Target Reconciled Balance (Supports inline math, e.g. 48250.75 + 1200)"
          value={reconciledBalance}
          onChange={setReconciledBalance}
          currency={activeAccount.currency}
        />
      </div>
    </Dialog>
  );
};

export const CreateAccountDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { family, createAccount } = useLedger();

  const [newAccType, setNewAccType] = useState<AccountType>('DEPOSITORY');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccBalance, setNewAccBalance] = useState<string>('0.00');
  const [newAccColor, setNewAccColor] = useState<string>('#078C52');
  const [newAccIcon, setNewAccIcon] = useState<string>('Wallet');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    await createAccount({
      name: newAccName.trim(),
      accountType: newAccType,
      currency: family.baseCurrency,
      initialBalance: newAccBalance,
      color: newAccColor,
      icon: newAccIcon,
      subtypeDetails: {},
    });
    setNewAccName('');
    setNewAccBalance('0.00');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Account"
      description="Supports all 9 Sure account classifications with automatic opening valuation."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateAccount}>Create Account</Button>
        </>
      }
    >
      <form onSubmit={handleCreateAccount} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Account Classification
          </label>
          <select
            value={newAccType}
            onChange={(e) => setNewAccType(e.target.value as AccountType)}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {GROUP_LABELS[t] || t} ({t})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Account Name
          </label>
          <input
            type="text"
            required
            value={newAccName}
            onChange={(e) => setNewAccName(e.target.value)}
            placeholder="e.g., Ally Online Checking, Vanguard Roth IRA, Bitcoin Cold Storage"
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
        </div>

        <MoneyField
          label="Opening Valuation Balance (Supports math: 125000 + 15000 * 2)"
          value={newAccBalance}
          onChange={setNewAccBalance}
          currency={family.baseCurrency}
        />

        <IconPicker
          selectedColor={newAccColor}
          selectedIcon={newAccIcon}
          onChangeColor={setNewAccColor}
          onChangeIcon={setNewAccIcon}
        />
      </form>
    </Dialog>
  );
};
