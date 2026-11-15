import React, { useMemo, useState } from 'react';
import { EntryType, compareMoney, sumMoney } from '@sure/shared';
import {
  Button,
  Card,
  CategoryIcon,
  CategorySelect,
  EmptyState,
  MoneyAmount,
  Pill,
  SearchInput,
} from '@sure/ui';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Lock,
  Plus,
  Scale,
  Tag as TagIcon,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useLedger, WebAccount, WebEntry } from '../../../lib/ledger-context.js';
import { formatGroupDateHeading } from './accountHistory.js';

export const AccountActivityTab: React.FC<{
  activeAccount: WebAccount;
  accountEntries: WebEntry[];
  selectedIds: Set<string>;
  onChangeSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onInspectEntry: (entry: WebEntry) => void;
  onOpenNewEntry: () => void;
}> = ({
  activeAccount,
  accountEntries,
  selectedIds,
  onChangeSelectedIds,
  onInspectEntry,
  onOpenNewEntry,
}) => {
  const {
    categories,
    merchants,
    tags,
    deleteEntries,
    bulkCategorizeEntries,
    bulkToggleExcludeEntries,
  } = useLedger();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | EntryType>('ALL');
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accountEntries.filter((e) => {
      if (typeFilter !== 'ALL' && e.entryType !== typeFilter) return false;
      if (!q) return true;
      const cat = categories.find((c) => c.id === e.categoryId);
      const merch = merchants.find((m) => m.id === e.merchantId);
      return (
        e.name.toLowerCase().includes(q) ||
        (cat?.name.toLowerCase().includes(q) ?? false) ||
        (merch?.name.toLowerCase().includes(q) ?? false) ||
        e.notes.toLowerCase().includes(q)
      );
    });
  }, [accountEntries, typeFilter, searchQuery, categories, merchants]);

  const groupedDates = useMemo(() => {
    const map = new Map<string, WebEntry[]>();
    for (const entry of filteredEntries) {
      const dateKey = entry.date.slice(0, 10);
      const list = map.get(dateKey) ?? [];
      list.push(entry);
      map.set(dateKey, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items,
        dailyNet: sumMoney(items.map((i) => i.amount)),
      }));
  }, [filteredEntries]);

  const toggleAllFiltered = () => {
    if (filteredEntries.length > 0 && selectedIds.size === filteredEntries.length) {
      onChangeSelectedIds(new Set());
    } else {
      onChangeSelectedIds(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const toggleGroupSelection = (items: WebEntry[]) => {
    const allChecked = items.every((i) => selectedIds.has(i.id));
    onChangeSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (allChecked) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  };

  const toggleSingleEntry = (id: string) => {
    onChangeSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredEntries.length > 0 && selectedIds.size === filteredEntries.length;

  return (
    <Card padding="none">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activity</h2>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenNewEntry}
          >
            New
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search entries by name..."
            className="flex-1 min-w-[220px]"
          />

          <div className="relative">
            <Button
              size="sm"
              variant={typeFilter === 'ALL' ? 'secondary' : 'primary'}
              icon={<Filter className="w-3.5 h-3.5" />}
              onClick={() => setFilterOpen((o) => !o)}
            >
              {typeFilter === 'ALL' ? 'Filter' : typeFilter}
            </Button>

            {filterOpen && (
              <div className="absolute right-0 top-10 z-20 w-44 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-lg p-1.5 space-y-0.5">
                {(['ALL', 'TRANSACTION', 'VALUATION', 'TRADE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTypeFilter(t);
                      setFilterOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer text-[var(--text-primary)]"
                  >
                    <span>{t === 'ALL' ? 'All entry types' : t}</span>
                    {typeFilter === t && <Check className="w-3.5 h-3.5 text-[var(--status-positive)]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)]">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              <strong className="font-semibold">{selectedIds.size}</strong>{' '}
              {selectedIds.size === 1 ? 'entry' : 'entries'} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <CategorySelect
                  options={categories}
                  value={bulkCategoryId || null}
                  onChange={(catId) => {
                    setBulkCategoryId(catId ?? '');
                    if (catId) {
                      void bulkCategorizeEntries(Array.from(selectedIds), catId);
                    }
                  }}
                  placeholder="Bulk categorize..."
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void bulkToggleExcludeEntries(Array.from(selectedIds))}
              >
                Exclude
              </Button>
              <Button
                size="sm"
                variant="destructive"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  void deleteEntries(Array.from(selectedIds));
                  onChangeSelectedIds(new Set());
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              aria-label="Select all account entries"
              className="rounded border-[var(--border-strong)] accent-[var(--accent-primary)] cursor-pointer"
            />
            <span>Date</span>
          </div>
          <span>Amount</span>
        </div>

        {groupedDates.length === 0 ? (
          <div className="py-10">
            <EmptyState
              title="No matching entries"
              description={`No ledger entries found in ${activeAccount.name} for the current filter.`}
              action={
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onOpenNewEntry}>
                  Add Entry
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {groupedDates.map((group) => {
              const collapsed = Boolean(collapsedDates[group.date]);
              const groupChecked = group.items.every((i) => selectedIds.has(i.id));
              return (
                <div
                  key={group.date}
                  className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-surface-subtle)]/70">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={groupChecked}
                        onChange={() => toggleGroupSelection(group.items)}
                        aria-label={`Select entries for ${group.date}`}
                        className="rounded border-[var(--border-strong)] accent-[var(--accent-primary)] cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedDates((prev) => ({
                            ...prev,
                            [group.date]: !collapsed,
                          }))
                        }
                        className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <span>{formatGroupDateHeading(group.date)}</span>
                        <span className="text-[var(--text-muted)]">•</span>
                        <span>{group.items.length}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <MoneyAmount
                        value={group.dailyNet}
                        currency={activeAccount.currency}
                        className="text-xs font-medium text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedDates((prev) => ({
                            ...prev,
                            [group.date]: !collapsed,
                          }))
                        }
                        aria-label={collapsed ? 'Expand date group' : 'Collapse date group'}
                        className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        {collapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {!collapsed && (
                    <div className="divide-y divide-[var(--border-primary)]">
                      {group.items.map((entry) => {
                        const cat = categories.find((c) => c.id === entry.categoryId);
                        const merch = merchants.find((m) => m.id === entry.merchantId);
                        const isPositiveAmt = compareMoney(entry.amount, '0') > 0;
                        const isTransfer = Boolean(entry.transferMatchId);
                        const subtitle = merch?.name || activeAccount.name;
                        const initial = (merch?.name || entry.name || 'S').charAt(0).toUpperCase();

                        return (
                          <div
                            key={entry.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onInspectEntry(entry)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onInspectEntry(entry);
                              }
                            }}
                            className={`grid grid-cols-12 items-center gap-2 px-3.5 py-3 hover:bg-[var(--bg-surface-hover)]/70 cursor-pointer transition-colors ${
                              entry.excluded ? 'opacity-65' : ''
                            }`}
                          >
                            <div className="col-span-6 sm:col-span-5 flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(entry.id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSingleEntry(entry.id)}
                                aria-label={`Select ${entry.name}`}
                                className="rounded border-[var(--border-strong)] accent-[var(--accent-primary)] cursor-pointer shrink-0"
                              />
                              {cat ? (
                                <CategoryIcon
                                  icon={cat.icon}
                                  label={cat.name}
                                  color={cat.color}
                                  variant="circle"
                                  size="sm"
                                />
                              ) : (
                                <span className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] shrink-0">
                                  {initial}
                                </span>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                                    {entry.name}
                                  </span>
                                  {entry.splits.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-[var(--text-secondary)] shrink-0">
                                      Split {entry.splits.length}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--text-secondary)] truncate">
                                  {subtitle}
                                </div>
                              </div>
                            </div>

                            <div className="hidden sm:flex sm:col-span-3 items-center gap-1.5">
                              {entry.entryType === 'VALUATION' ? (
                                <Pill
                                  label={entry.valuationKind || 'Valuation'}
                                  icon={<Scale className="w-3 h-3" />}
                                  color="#8b5cf6"
                                  size="xs"
                                />
                              ) : entry.entryType === 'TRADE' ? (
                                <Pill
                                  label={entry.tradeDetails?.tradeAction || 'Trade'}
                                  icon={<TrendingUp className="w-3 h-3" />}
                                  color="#3b82f6"
                                  size="xs"
                                />
                              ) : isTransfer ? (
                                <Pill
                                  label="Transfer"
                                  icon={<ArrowLeftRight className="w-3 h-3" />}
                                  color="#64748b"
                                  size="xs"
                                />
                              ) : cat ? (
                                <Pill
                                  label={cat.name}
                                  icon={
                                    <CategoryIcon
                                      icon={cat.icon}
                                      label={cat.name}
                                      color={cat.color}
                                      size="xs"
                                    />
                                  }
                                  color={cat.color}
                                  size="xs"
                                />
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border border-dashed border-[var(--border-strong)] text-[var(--text-secondary)] whitespace-nowrap">
                                  Uncategorized
                                </span>
                              )}
                            </div>

                            <div className="hidden md:flex md:col-span-2 items-center justify-end gap-2 text-[var(--text-muted)]">
                              {entry.tagIds.length > 0 && (
                                <span
                                  title={entry.tagIds
                                    .map((tid) => tags.find((t) => t.id === tid)?.name ?? '')
                                    .filter(Boolean)
                                    .join(', ')}
                                  className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]"
                                >
                                  <TagIcon className="w-3.5 h-3.5" />
                                  <span>{entry.tagIds.length}</span>
                                </span>
                              )}
                              {isTransfer && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-[var(--text-secondary)] whitespace-nowrap">
                                  Auto-matched
                                </span>
                              )}
                              {(entry.importId || isTransfer) && <Lock className="w-3 h-3 shrink-0" />}
                            </div>

                            <div className="col-span-6 sm:col-span-4 md:col-span-2 flex items-center justify-end gap-2">
                              {entry.excluded && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-primary)] text-[var(--text-muted)]">
                                  Excl.
                                </span>
                              )}
                              <span
                                className={`text-sm font-medium ${
                                  entry.entryType === 'TRANSACTION' && isPositiveAmt
                                    ? 'text-[var(--status-positive)]'
                                    : 'text-[var(--text-primary)]'
                                }`}
                              >
                                <MoneyAmount
                                  value={entry.amount}
                                  currency={entry.currency}
                                  showSign={entry.entryType === 'TRANSACTION'}
                                />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
