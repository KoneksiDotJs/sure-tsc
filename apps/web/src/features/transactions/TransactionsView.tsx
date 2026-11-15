import React, { useMemo, useState } from 'react';
import { EntryType, absMoney, addMoney, compareMoney } from '@sure/shared';
import {
  Button,
  DataTable,
  EmptyState,
  MoneyAmount,
  SearchInput,
  SegmentedControl,
} from '@sure/ui';
import {
  ArrowLeftRight,
  Download,
  EyeOff,
  FileText,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useLedger, type WebEntry } from '../../lib/ledger-context.js';
import { buildTransactionColumns, exportEntriesToCsv } from './components/transactionColumns.js';
import { EntryInspectorDrawer } from './components/EntryInspectorDrawer.js';
import { SplitTransactionDialog } from './components/SplitTransactionDialog.js';
import { TransferMatchDialog } from './components/TransferMatchDialog.js';
import { CreateEntryDialog } from './components/CreateEntryDialog.js';

export const TransactionsView: React.FC = () => {
  const {
    family,
    accounts,
    categories,
    merchants,
    tags,
    entries,
    createEntry,
    updateEntry,
    deleteEntries,
    splitEntry,
    createTransfer,
    matchTransfer,
    bulkCategorizeEntries,
    bulkToggleExcludeEntries,
    createCategory,
    createMerchant,
    createTag,
    runBayesAutoCategorizer,
    fetchTransferSuggestions,
  } = useLedger();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | EntryType>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) ?? null,
    [entries, activeEntryId]
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== 'ALL' && e.entryType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const cat = categories.find((c) => c.id === e.categoryId);
        const merch = merchants.find((m) => m.id === e.merchantId);
        return (
          e.name.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q) ||
          (cat && cat.name.toLowerCase().includes(q)) ||
          (merch && merch.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [entries, typeFilter, search, categories, merchants]);

  const ledgerSummary = useMemo(() => {
    let income = '0.0000';
    let expenses = '0.0000';
    for (const e of filteredEntries) {
      if (e.entryType !== 'TRANSACTION' || e.excluded || e.splits.length > 0) continue;
      if (compareMoney(e.amount, '0.0000') > 0) income = addMoney(income, e.amount);
      else if (compareMoney(e.amount, '0.0000') < 0) expenses = addMoney(expenses, absMoney(e.amount));
    }
    return { count: filteredEntries.length, income, expenses };
  }, [filteredEntries]);

  const columns = useMemo(
    () => buildTransactionColumns(accounts, categories, merchants),
    [accounts, categories, merchants]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Polymorphic Ledger Entries
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Navigate rows with{' '}
            <kbd className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] font-mono-tabular">
              j
            </kbd>{' '}
            /{' '}
            <kbd className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] font-mono-tabular">
              k
            </kbd>{' '}
            and press{' '}
            <kbd className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] font-mono-tabular">
              Enter
            </kbd>{' '}
            to inspect in SlideOverDrawer
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => void runBayesAutoCategorizer()}
          >
            Auto-Categorize (Bayes)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={() => exportEntriesToCsv(filteredEntries, accounts, categories)}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            onClick={() => setTransferModalOpen(true)}
          >
            Match Transfer
          </Button>
          <Button
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Add Entry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-primary)]">
        <div className="px-4 py-3">
          <div className="text-xs text-[var(--text-secondary)]">Total transactions</div>
          <div className="text-xl font-semibold font-mono-tabular mt-0.5 text-[var(--text-primary)]">
            {ledgerSummary.count}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-[var(--text-secondary)]">Income</div>
          <div className="text-xl font-semibold font-mono-tabular mt-0.5">
            <MoneyAmount value={ledgerSummary.income} currency={family.baseCurrency} />
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-[var(--text-secondary)]">Expenses</div>
          <div className="text-xl font-semibold font-mono-tabular mt-0.5">
            <MoneyAmount value={ledgerSummary.expenses} currency={family.baseCurrency} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} className="w-full sm:w-80" />
        <SegmentedControl<'ALL' | EntryType>
          options={[
            { value: 'ALL', label: 'All Entries' },
            { value: 'TRANSACTION', label: 'Transactions' },
            { value: 'VALUATION', label: 'Valuations' },
            { value: 'TRADE', label: 'Trades' },
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
        />
      </div>

      <DataTable<WebEntry>
        data={filteredEntries}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(row) => setActiveEntryId(row.id)}
        emptyState={
          <EmptyState
            icon={<FileText className="w-5 h-5" />}
            title="No matching ledger entries"
            description="Adjust your search filters or record a new Transaction, Valuation, or Trade."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Add First Entry
              </Button>
            }
          />
        }
        bulkActionsBar={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void bulkCategorizeEntries(selectedIds, 'cat-groceries');
                setSelectedIds([]);
              }}
            >
              Categorize as Groceries
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<EyeOff className="w-3.5 h-3.5" />}
              onClick={() => {
                void bulkToggleExcludeEntries(selectedIds);
                setSelectedIds([]);
              }}
            >
              Toggle Exclude
            </Button>
            <Button
              size="sm"
              variant="destructive"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => {
                void deleteEntries(selectedIds);
                setSelectedIds([]);
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      <EntryInspectorDrawer
        activeEntry={activeEntry}
        categories={categories}
        merchants={merchants}
        tags={tags}
        onClose={() => setActiveEntryId(null)}
        onUpdateEntry={updateEntry}
        onDeleteEntry={(id) => deleteEntries([id])}
        onCreateCategory={createCategory}
        onCreateMerchant={createMerchant}
        onCreateTag={createTag}
        onOpenSplits={() => setSplitModalOpen(true)}
      />

      <SplitTransactionDialog
        open={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        activeEntry={activeEntry}
        baseCurrency={family.baseCurrency}
        onSaveSplits={splitEntry}
      />

      <TransferMatchDialog
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        baseCurrency={family.baseCurrency}
        accounts={accounts}
        entries={entries}
        fetchTransferSuggestions={fetchTransferSuggestions}
        onCreateTransfer={createTransfer}
        onMatchTransfer={matchTransfer}
      />

      <CreateEntryDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        baseCurrency={family.baseCurrency}
        accounts={accounts}
        categories={categories}
        onCreateEntry={createEntry}
      />
    </div>
  );
};
