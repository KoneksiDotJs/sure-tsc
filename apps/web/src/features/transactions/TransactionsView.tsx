import React, { useState, useMemo } from 'react';
import {
  EntryType,
  compareMoney,
  addMoney,
  absMoney,
  sumMoney,
  subMoney,
} from '@sure/shared';
import {
  DataTable,
  DataTableColumn,
  MoneyAmount,
  MoneyField,
  Pill,
  CategoryIcon,
  Button,
  SearchInput,
  SegmentedControl,
  SlideOverDrawer,
  CategorySelect,
  MerchantSelect,
  TagSelect,
  Toggle,
  Dialog,
  EmptyState,
} from '@sure/ui';
import {
  useLedger,
  WebEntry,
  WebSplitItem,
  WebTransferSuggestion,
} from '../../lib/ledger-context.js';
import {
  Plus,
  Split,
  ArrowLeftRight,
  Trash2,
  EyeOff,
  Sparkles,
  FileText,
  Download,
  Lock,
  TrendingUp,
  Scale,
  Shapes,
} from 'lucide-react';

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

  // Create Entry Modal state
  const [createOpen, setCreateOpen] = useState(false);
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

  // Split Transaction Modal state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitRows, setSplitRows] = useState<WebSplitItem[]>([]);

  // Transfer Match / Create Modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
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

  const openTransferModal = async () => {
    setTransferModalOpen(true);
    setSuggestionsLoading(true);
    try {
      const list = await fetchTransferSuggestions();
      setTransferSuggestions(list);
      if (list.length > 0) {
        setTransferMode('MATCH');
      }
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleExportCsv = () => {
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
  };

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
    return {
      count: filteredEntries.length,
      income,
      expenses,
    };
  }, [filteredEntries]);

  const columns: DataTableColumn<WebEntry>[] = [
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

  const openSplitModal = (entry: WebEntry) => {
    if (entry.splits.length >= 2) {
      setSplitRows(entry.splits);
    } else {
      const half = subMoney(entry.amount, '0.0000');
      setSplitRows([
        {
          id: 'sp-1',
          name: `${entry.name} (Part 1)`,
          amount: half,
          categoryId: entry.categoryId,
        },
        {
          id: 'sp-2',
          name: `${entry.name} (Part 2)`,
          amount: '0.0000',
          categoryId: null,
        },
      ]);
    }
    setSplitModalOpen(true);
  };

  const splitTotal = sumMoney(splitRows.map((s) => s.amount));
  const splitRemaining = activeEntry
    ? subMoney(activeEntry.amount, splitTotal)
    : '0.0000';
  const isSplitValid =
    activeEntry !== null && compareMoney(splitTotal, activeEntry.amount) === 0;

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Polymorphic Ledger Entries
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Navigate rows with <kbd className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] font-mono-tabular">j</kbd> / <kbd className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] font-mono-tabular">k</kbd> and press <kbd className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] font-mono-tabular">Enter</kbd> to inspect in SlideOverDrawer
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => {
              runBayesAutoCategorizer();
            }}
          >
            Auto-Categorize (Bayes)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            onClick={() => void openTransferModal()}
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

      {/* Transactions KPI Summary Strip (matches app.sure.am Transactions header) */}
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          className="w-full sm:w-80"
        />
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

      {/* Main DataTable */}
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
                bulkCategorizeEntries(selectedIds, 'cat-groceries');
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
                bulkToggleExcludeEntries(selectedIds);
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
                deleteEntries(selectedIds);
                setSelectedIds([]);
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      {/* Right-Hand SlideOverDrawer Transaction Inspector (DESIGN-SYSTEM.md #18) */}
      <SlideOverDrawer
        open={Boolean(activeEntry)}
        onClose={() => setActiveEntryId(null)}
        title={activeEntry?.name ?? 'Inspect Entry'}
        subtitle={
          activeEntry
            ? `${activeEntry.entryType} • ${activeEntry.date} • ID: ${activeEntry.id}`
            : ''
        }
        footer={
          activeEntry && (
            <>
              <Button
                variant="destructive"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  deleteEntries([activeEntry.id]);
                  setActiveEntryId(null);
                }}
              >
                Delete Entry
              </Button>
              <Button size="sm" onClick={() => setActiveEntryId(null)}>
                Done
              </Button>
            </>
          )
        }
      >
        {activeEntry && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Payee / Entry Name
              </label>
              <input
                type="text"
                value={activeEntry.name}
                onChange={(e) => updateEntry(activeEntry.id, { name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
              />
            </div>

            <MoneyField
              label="Amount (Inline arithmetic supported, e.g. -120.50 - 30.25)"
              value={activeEntry.amount}
              onChange={(val) => updateEntry(activeEntry.id, { amount: val })}
              currency={activeEntry.currency}
            />

            {activeEntry.entryType === 'TRANSACTION' && (
              <>
                <CategorySelect
                  label="Category"
                  options={categories}
                  value={activeEntry.categoryId}
                  onChange={(categoryId) => void updateEntry(activeEntry.id, { categoryId })}
                  onCreateNew={async (name) => {
                    const created = await createCategory(name);
                    await updateEntry(activeEntry.id, { categoryId: created.id });
                  }}
                />

                <MerchantSelect
                  label="Merchant"
                  options={merchants}
                  value={activeEntry.merchantId}
                  onChange={(merchantId) => void updateEntry(activeEntry.id, { merchantId })}
                  onCreateNew={async (name) => {
                    const created = await createMerchant(name);
                    await updateEntry(activeEntry.id, { merchantId: created.id });
                  }}
                />

                <TagSelect
                  label="Tags"
                  options={tags}
                  selectedIds={activeEntry.tagIds}
                  onChange={(tagIds) => void updateEntry(activeEntry.id, { tagIds })}
                  onCreateNew={async (name) => {
                    const created = await createTag(name);
                    await updateEntry(activeEntry.id, {
                      tagIds: [...activeEntry.tagIds, created.id],
                    });
                  }}
                />

                <div className="pt-2 border-t border-[var(--border-primary)]">
                  <Toggle
                    checked={activeEntry.excluded}
                    onChange={(excluded) => updateEntry(activeEntry.id, { excluded })}
                    label="Exclude from Budgets & Income Reports"
                    description="Internal transfers or one-off pass-through items"
                  />
                </div>

                <div className="pt-2 border-t border-[var(--border-primary)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Split Transaction ({activeEntry.splits.length})
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Split className="w-3.5 h-3.5" />}
                      onClick={() => openSplitModal(activeEntry)}
                    >
                      Configure Splits
                    </Button>
                  </div>
                  {activeEntry.splits.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 text-xs rounded-md bg-[var(--bg-surface-subtle)]"
                    >
                      <span>{s.name}</span>
                      <MoneyAmount value={s.amount} currency={activeEntry.currency} />
                    </div>
                  ))}
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Notes & Audit Memo
              </label>
              <textarea
                rows={3}
                value={activeEntry.notes}
                onChange={(e) => updateEntry(activeEntry.id, { notes: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
              />
            </div>
          </div>
        )}
      </SlideOverDrawer>

      {/* Split Transaction Modal (FR-2.4) */}
      <Dialog
        open={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        title="Split Transaction Across Categories"
        description={`Parent Transaction Total: ${activeEntry?.amount ?? '0.0000'} USD`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSplitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!isSplitValid}
              onClick={() => {
                if (activeEntry && isSplitValid) {
                  splitEntry(activeEntry.id, splitRows);
                  setSplitModalOpen(false);
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

      {/* Internal Transfer Create & Matching Modal */}
      <Dialog
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Internal Transfer Between Family Accounts"
        description="Create a new paired transfer or link existing outflow/inflow entries (`TransferMatch`)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferModalOpen(false)}>
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
                  await createTransfer({
                    fromAccountId: effectiveFromAccountId,
                    toAccountId: effectiveToAccountId,
                    date: transferDate,
                    amount: transferAmount,
                    ...(transferName.trim() ? { name: transferName.trim() } : {}),
                  });
                  setTransferName('');
                  setTransferModalOpen(false);
                }}
              >
                Create Transfer
              </Button>
            ) : (
              <Button
                disabled={!outflowId || !inflowId}
                onClick={async () => {
                  if (outflowId && inflowId) {
                    await matchTransfer(outflowId, inflowId);
                    setTransferModalOpen(false);
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
                              void matchTransfer(s.outflowEntryId, s.inflowEntryId);
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

      {/* Create Entry Modal */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Record Polymorphic Ledger Entry"
        description="Creates a TRANSACTION, VALUATION, or TRADE and triggers BalanceService materialization."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newName.trim() || !effectiveAccountId) return;
                const targetAccount = accounts.find((a) => a.id === effectiveAccountId);
                await createEntry({
                  accountId: effectiveAccountId,
                  entryType: newEntryType,
                  date: newDate,
                  amount: newAmount,
                  currency: targetAccount?.currency ?? 'USD',
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
                setCreateOpen(false);
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
                  onChange={(e) => setTradeAction(e.target.value as 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT')}
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
    </div>
  );
};
