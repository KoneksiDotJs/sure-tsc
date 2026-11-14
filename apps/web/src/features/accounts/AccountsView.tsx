import React, { useEffect, useMemo, useState } from 'react';
import {
  AccountType,
  EntryType,
  absMoney,
  addMoney,
  calculateLoanAmortization,
  compareMoney,
  divMoney,
  formatCurrency,
  isZeroMoney,
  mulMoney,
  subMoney,
  sumMoney,
} from '@sure/shared';
import {
  Button,
  Card,
  CategoryIcon,
  CategorySelect,
  DetailRow,
  Dialog,
  Disclosure,
  EmptyState,
  IconPicker,
  MerchantSelect,
  MoneyAmount,
  MoneyField,
  Pill,
  ResponsiveAreaChart,
  SearchInput,
  SegmentedControl,
  SlideOverDrawer,
  TagSelect,
  Toggle,
} from '@sure/ui';
import {
  ArrowLeftRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Check,
  Filter,
  Lock,
  MoreHorizontal,
  Plus,
  Scale,
  Tag as TagIcon,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useLedger, WebAccount, WebEntry, WebHoldingsSummary } from '../../lib/ledger-context.js';

export interface AccountsViewProps {
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string) => void;
}

type TimeframeKey = '30D' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
type AccountSubTab = 'activity' | 'statements' | 'holdings' | 'loan';

const ACCOUNT_TYPES: AccountType[] = [
  'DEPOSITORY',
  'CREDIT_CARD',
  'INVESTMENT',
  'CRYPTO',
  'PROPERTY',
  'VEHICLE',
  'LOAN',
  'OTHER_ASSET',
  'OTHER_LIABILITY',
];

const TIMEFRAME_LABELS: Record<TimeframeKey, string> = {
  '30D': 'last 30 days',
  '3M': 'last 3 months',
  '6M': 'last 6 months',
  YTD: 'year to date',
  '1Y': 'last 12 months',
  ALL: 'all time',
};

const TIMEFRAME_OPTIONS: Array<{ value: TimeframeKey; label: string }> = [
  { value: '30D', label: '30D' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' },
];

const GROUP_LABELS: Record<string, string> = {
  DEPOSITORY: 'Cash & Checking',
  INVESTMENT: 'Investments',
  CRYPTO: 'Crypto',
  PROPERTY: 'Property',
  VEHICLE: 'Vehicles',
  OTHER_ASSET: 'Other Assets',
  CREDIT_CARD: 'Credit Cards',
  LOAN: 'Loans & Mortgages',
  OTHER_LIABILITY: 'Other Liabilities',
};

function formatSubtypeLabel(acc: WebAccount): string {
  const details = acc.subtypeDetails ?? {};
  const rawSubtype =
    typeof details.accountSubtype === 'string'
      ? details.accountSubtype
      : typeof details.loanSubtype === 'string'
      ? details.loanSubtype
      : typeof details.propertyType === 'string'
      ? details.propertyType
      : typeof details.walletType === 'string'
      ? details.walletType
      : acc.accountType;

  return rawSubtype
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function isoDaysAgo(baseDate: string, days: number): string {
  const d = new Date(`${baseDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatGroupDateHeading(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate.toUpperCase();
  return d
    .toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
}

function formatInspectorDate(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getTimeframeStartDate(timeframe: TimeframeKey, todayIso: string, earliestIso: string): string {
  switch (timeframe) {
    case '30D':
      return isoDaysAgo(todayIso, 30);
    case '3M':
      return isoDaysAgo(todayIso, 90);
    case '6M':
      return isoDaysAgo(todayIso, 180);
    case 'YTD':
      return `${todayIso.slice(0, 4)}-01-01`;
    case '1Y':
      return isoDaysAgo(todayIso, 365);
    case 'ALL':
      return earliestIso < isoDaysAgo(todayIso, 30) ? earliestIso : isoDaysAgo(todayIso, 30);
  }
}

function buildAccountHistorySeries(
  account: WebAccount,
  accountEntries: WebEntry[],
  timeframe: TimeframeKey
): Array<{ date: string; value: number; balanceStr: string }> {
  const sortedEntries = [...accountEntries].sort((a, b) => a.date.localeCompare(b.date));
  const latestEntryDate = sortedEntries[sortedEntries.length - 1]?.date.slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const endDate = latestEntryDate && latestEntryDate > todayIso ? latestEntryDate : todayIso;

  // Use materialized 30D sparkline directly when 30D has meaningful points and no post-sparkline skew
  if (timeframe === '30D' && account.sparkline.length >= 2) {
    const pts = account.sparkline;
    return pts.map((v, idx) => ({
      date: isoDaysAgo(endDate, pts.length - 1 - idx),
      value: v,
      balanceStr: v.toFixed(4),
    }));
  }

  const earliestEntryDate = sortedEntries[0]?.date.slice(0, 10) ?? isoDaysAgo(endDate, 30);
  const startDate = getTimeframeStartDate(timeframe, endDate, earliestEntryDate);

  // Reconstruct daily snapshot series walking backwards from current account.balance
  // using Sure BalanceService flowsFactor (-1 for LIABILITY, +1 for ASSET)
  const dailyDelta = new Map<string, string>();
  const flowsFactor = account.classification === 'LIABILITY' ? '-1' : '1';
  for (const e of sortedEntries) {
    const d = e.date.slice(0, 10);
    if (e.entryType === 'TRANSACTION') {
      const signedImpact = mulMoney(e.amount, flowsFactor);
      dailyDelta.set(d, addMoney(dailyDelta.get(d) ?? '0', signedImpact));
    }
  }

  const totalDays = Math.max(
    14,
    Math.round(
      (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
        86_400_000
    )
  );
  const stepDays = totalDays > 60 ? Math.ceil(totalDays / 45) : 1;

  // Walk day-by-day backwards from endDate down to startDate
  const dailyBalances = new Map<string, string>();
  let cursor = account.balance;
  for (let offset = 0; offset <= totalDays; offset++) {
    const d = isoDaysAgo(endDate, offset);
    dailyBalances.set(d, cursor);
    const delta = dailyDelta.get(d);
    if (delta) {
      cursor = subMoney(cursor, delta);
    }
  }

  const series: Array<{ date: string; value: number; balanceStr: string }> = [];
  for (let offset = totalDays; offset >= 0; offset -= stepDays) {
    const d = isoDaysAgo(endDate, offset);
    const bal = dailyBalances.get(d) ?? account.balance;
    series.push({
      date: d,
      value: Number(bal),
      balanceStr: bal,
    });
  }

  const lastPoint = series[series.length - 1];
  if (!lastPoint || lastPoint.date !== endDate) {
    series.push({
      date: endDate,
      value: Number(account.balance),
      balanceStr: account.balance,
    });
  }

  return series;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  selectedAccountId,
  onSelectAccount,
}) => {
  const {
    family,
    accounts,
    categories,
    merchants,
    tags,
    entries,
    createAccount,
    deleteAccount,
    fetchAccountHoldings,
    upsertAccountHolding,
    createEntry,
    updateEntry,
    deleteEntries,
    bulkCategorizeEntries,
    bulkToggleExcludeEntries,
    createCategory,
    createMerchant,
    createTag,
  } = useLedger();

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId]
  );

  // Page view state
  const [timeframe, setTimeframe] = useState<TimeframeKey>('30D');
  const [subTab, setSubTab] = useState<AccountSubTab>('activity');
  const [actionsMenuOpen, setActionsMenuOpen] = useState<boolean>(false);

  // Activity filtering & selection state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | EntryType>('ALL');
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');

  // Inspector Drawer state (Screenshot 3 style)
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [draftDate, setDraftDate] = useState<string>('');
  const [draftType, setDraftType] = useState<EntryType>('TRANSACTION');
  const [draftAmount, setDraftAmount] = useState<string>('0.00');
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);
  const [draftMerchantId, setDraftMerchantId] = useState<string | null>(null);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [draftExcluded, setDraftExcluded] = useState<boolean>(false);

  // New Entry Modal (pre-scoped to activeAccount)
  const [newEntryOpen, setNewEntryOpen] = useState<boolean>(false);
  const [entryName, setEntryName] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [entryType, setEntryType] = useState<EntryType>('TRANSACTION');
  const [entryAmount, setEntryAmount] = useState<string>('-45.00');
  const [entryCategoryId, setEntryCategoryId] = useState<string | null>(null);

  // Reconcile Anchor Valuation Modal
  const [reconcileOpen, setReconcileOpen] = useState<boolean>(false);
  const [reconciledBalance, setReconciledBalance] = useState<string>('0.00');

  // Create Account Modal
  const [createAccountOpen, setCreateAccountOpen] = useState<boolean>(false);
  const [newAccType, setNewAccType] = useState<AccountType>('DEPOSITORY');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccBalance, setNewAccBalance] = useState<string>('0.00');
  const [newAccColor, setNewAccColor] = useState<string>('#078C52');
  const [newAccIcon, setNewAccIcon] = useState<string>('Wallet');

  // Portfolio Holdings State
  const [holdingsData, setHoldingsData] = useState<WebHoldingsSummary | null>(null);
  const [holdingsLoading, setHoldingsLoading] = useState<boolean>(false);
  const [holdingTicker, setHoldingTicker] = useState<string>('');
  const [holdingName, setHoldingName] = useState<string>('');
  const [holdingQty, setHoldingQty] = useState<string>('10');
  const [holdingCost, setHoldingCost] = useState<string>('100.00');
  const [holdingPrice, setHoldingPrice] = useState<string>('115.00');

  // Loan Simulator State
  const [extraPayment, setExtraPayment] = useState<string>('500.00');

  // Sync sub-tab & clear per-account ephemeral selection when switching accounts
  useEffect(() => {
    setSelectedIds(new Set());
    setInspectingId(null);
    setActionsMenuOpen(false);
    setHoldingsData(null);
    if (!activeAccount) return;
    setSubTab((current) => {
      if (current === 'holdings' && activeAccount.accountType !== 'INVESTMENT' && activeAccount.accountType !== 'CRYPTO') {
        return 'activity';
      }
      if (current === 'loan' && activeAccount.accountType !== 'LOAN') {
        return 'activity';
      }
      return current;
    });
  }, [activeAccount?.id]);

  // Lazy-fetch Holdings whenever Holdings tab opens on Investment/Crypto accounts
  useEffect(() => {
    if (
      !activeAccount ||
      subTab !== 'holdings' ||
      (activeAccount.accountType !== 'INVESTMENT' && activeAccount.accountType !== 'CRYPTO')
    ) {
      return;
    }
    let cancelled = false;
    setHoldingsLoading(true);
    fetchAccountHoldings(activeAccount.id)
      .then((res) => {
        if (!cancelled) setHoldingsData(res);
      })
      .catch(() => {
        if (!cancelled) setHoldingsData(null);
      })
      .finally(() => {
        if (!cancelled) setHoldingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAccount?.id, subTab]);

  // All ledger entries belonging to this account
  const accountEntries = useMemo(() => {
    if (!activeAccount) return [];
    return entries
      .filter((e) => e.accountId === activeAccount.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, activeAccount]);

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

  // Group filtered entries by date (Screenshot 2)
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

  // Interactive Balance Chart Series + Fixed-Point Delta Math
  const chartSeries = useMemo(() => {
    if (!activeAccount) return [];
    return buildAccountHistorySeries(activeAccount, accountEntries, timeframe);
  }, [activeAccount, accountEntries, timeframe]);

  const balanceMetrics = useMemo(() => {
    if (!activeAccount || chartSeries.length === 0) {
      return {
        deltaStr: '0.0000',
        pctStr: '0.0',
        isPositive: true,
        isFlat: true,
        chartColor: '#6b7280',
      };
    }
    const startStr = chartSeries[0]!.balanceStr;
    const endStr = chartSeries[chartSeries.length - 1]!.balanceStr;
    const deltaStr = subMoney(endStr, startStr);
    const isFlat = isZeroMoney(deltaStr);
    const isPositive = compareMoney(deltaStr, '0') >= 0;
    const pctStr = isZeroMoney(startStr)
      ? '0.0'
      : Math.abs(
          Number(mulMoney(divMoney(deltaStr, absMoney(startStr)), '100'))
        ).toFixed(1);

    // For liabilities, reduction in debt is favorable, growth in debt is warning
    const favorable =
      activeAccount.classification === 'LIABILITY'
        ? compareMoney(deltaStr, '0') <= 0
        : isPositive;
    const chartColor = isFlat ? '#6b7280' : favorable ? '#078C52' : '#ef4444';

    return {
      deltaStr,
      pctStr,
      isPositive,
      isFlat,
      chartColor,
    };
  }, [activeAccount, chartSeries]);

  // Statement Monthly Rollup Summary for the "Statements" tab
  const monthlyStatements = useMemo(() => {
    if (!activeAccount) return [];
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
  }, [activeAccount, accountEntries]);

  // Loan Amortization Calculation (only when viewing a LOAN account)
  const loanSchedule = useMemo(() => {
    if (!activeAccount || activeAccount.accountType !== 'LOAN') return null;
    const rate = String(activeAccount.subtypeDetails?.interestRatePercent ?? '6.0');
    const term = Number(activeAccount.subtypeDetails?.termMonths ?? 360);
    return calculateLoanAmortization({
      principal: absMoney(activeAccount.balance),
      annualInterestRatePercent: rate,
      termMonths: term,
      extraMonthlyPayment: extraPayment || '0',
    });
  }, [activeAccount, extraPayment]);

  const inspectingEntry = useMemo(
    () => entries.find((e) => e.id === inspectingId) ?? null,
    [entries, inspectingId]
  );

  const openInspector = (entry: WebEntry) => {
    setInspectingId(entry.id);
    setDraftName(entry.name);
    setDraftDate(entry.date.slice(0, 10));
    setDraftType(entry.entryType);
    setDraftAmount(entry.amount);
    setDraftCategoryId(entry.categoryId);
    setDraftMerchantId(entry.merchantId);
    setDraftTagIds(entry.tagIds);
    setDraftNotes(entry.notes);
    setDraftExcluded(entry.excluded);
  };

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
    setInspectingId(null);
  };

  const handleCreateAccountEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !entryName.trim()) return;
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
    setNewEntryOpen(false);
  };

  const handleCommitReconciliation = async () => {
    if (!activeAccount) return;
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
    setReconcileOpen(false);
  };

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
    setCreateAccountOpen(false);
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !holdingTicker.trim()) return;
    const res = await upsertAccountHolding(activeAccount.id, {
      ticker: holdingTicker.trim().toUpperCase(),
      securityName: holdingName.trim() || holdingTicker.trim().toUpperCase(),
      assetClass: activeAccount.accountType === 'CRYPTO' ? 'CRYPTO' : 'EQUITY',
      qty: holdingQty,
      avgCostBasis: holdingCost,
      currentPrice: holdingPrice,
    });
    setHoldingsData(res);
    setHoldingTicker('');
    setHoldingName('');
  };

  const toggleAllFiltered = () => {
    if (filteredEntries.length > 0 && selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const toggleGroupSelection = (items: WebEntry[]) => {
    const allChecked = items.every((i) => selectedIds.has(i.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (allChecked) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  };

  const toggleSingleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const availableSubTabs = useMemo(() => {
    const tabs: Array<{ value: AccountSubTab; label: string }> = [
      { value: 'activity', label: 'Activity' },
      { value: 'statements', label: 'Statements' },
    ];
    if (activeAccount?.accountType === 'INVESTMENT' || activeAccount?.accountType === 'CRYPTO') {
      tabs.push({ value: 'holdings', label: 'Holdings' });
    }
    if (activeAccount?.accountType === 'LOAN') {
      tabs.push({ value: 'loan', label: 'Loan Simulator' });
    }
    return tabs;
  }, [activeAccount?.accountType]);

  const allFilteredSelected =
    filteredEntries.length > 0 && selectedIds.size === filteredEntries.length;

  return (
    <div className="space-y-5">
      {!activeAccount ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                Accounts
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Create your first account across Checking, Credit Card, Investment, Property, or Loan.
              </p>
            </div>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAccountOpen(true)}>
              New Account
            </Button>
          </div>
          <EmptyState
            title="No accounts in this family"
            description="Add a Depository, Investment, Credit Card, Property, or Loan account to start tracking net worth and activity."
            action={
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAccountOpen(true)}>
                Create First Account
              </Button>
            }
          />
        </div>
      ) : (
        <>
      {/* Compact Account Quick-Switcher Pills (especially useful on narrow viewports or direct tab switch) */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {accounts.map((acc) => {
            const selected = acc.id === activeAccount.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectAccount?.(acc.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 cursor-pointer border transition-colors ${
                  selected
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-xs'
                    : 'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <CategoryIcon
                  icon={acc.icon || 'Wallet'}
                  label={acc.name}
                  color={acc.color}
                  variant="circle"
                  size="xs"
                />
                <span>{acc.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 1. Account Detail Header (Matches Sure Screenshot 1: Circular badge + Account Name + Action Controls) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CategoryIcon
            icon={activeAccount.icon || 'Wallet'}
            label={activeAccount.name}
            color={activeAccount.color}
            variant="circle"
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight truncate">
                {activeAccount.name}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                {formatSubtypeLabel(activeAccount)} • {activeAccount.currency}
              </span>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Scale className="w-3.5 h-3.5" />}
            onClick={() => {
              setReconciledBalance(activeAccount.balance);
              setReconcileOpen(true);
            }}
          >
            Reconcile
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setCreateAccountOpen(true)}
          >
            New account
          </Button>
          <button
            type="button"
            onClick={() => setActionsMenuOpen((v) => !v)}
            aria-label="Account actions"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] bg-[var(--bg-surface)] cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {actionsMenuOpen && (
            <div className="absolute right-0 top-10 z-30 w-52 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-lg p-1.5 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setActionsMenuOpen(false);
                  setReconciledBalance(activeAccount.balance);
                  setReconcileOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer text-[var(--text-primary)]"
              >
                <Scale className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Reconcile Anchor Valuation</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionsMenuOpen(false);
                  setNewEntryOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer text-[var(--text-primary)]"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Add New Entry</span>
              </button>
              <div className="my-1 border-t border-[var(--border-primary)]" />
              <button
                type="button"
                onClick={() => {
                  setActionsMenuOpen(false);
                  void deleteAccount(activeAccount.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-red-500/10 text-left cursor-pointer text-[var(--status-negative)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Hero Balance Card with Interactive Area Chart (Matches Sure Screenshot 1) */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div>
            <div className="text-xs font-medium text-[var(--text-secondary)] mb-1">Balance</div>
            <div className="text-3xl font-bold text-[var(--text-primary)] tracking-tight leading-none mb-2">
              <MoneyAmount
                value={activeAccount.balance}
                currency={activeAccount.currency}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className="font-mono-tabular font-medium inline-flex items-center gap-1"
                style={{ color: balanceMetrics.chartColor }}
              >
                <MoneyAmount
                  value={balanceMetrics.deltaStr}
                  currency={activeAccount.currency}
                  showSign
                />
                <span>
                  ({balanceMetrics.isFlat ? '0.0%' : `${balanceMetrics.isPositive ? '↑' : '↓'}${balanceMetrics.pctStr}%`})
                </span>
              </span>
              <span className="text-[var(--text-secondary)]">
                vs. {TIMEFRAME_LABELS[timeframe]}
              </span>
            </div>
          </div>

          <SegmentedControl
            size="sm"
            value={timeframe}
            onChange={setTimeframe}
            options={TIMEFRAME_OPTIONS}
          />
        </div>

        <ResponsiveAreaChart
          data={chartSeries}
          height={210}
          color={balanceMetrics.chartColor}
          primaryLabel={activeAccount.name}
          formatValue={(v) => formatCurrency(v.toFixed(2), activeAccount.currency)}
          showDateAxis
        />
      </Card>

      {/* 3. Sub-Tab Switcher (Matches Screenshot 1: Activity | Statements [+ Holdings / Loan Simulator when applicable]) */}
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          size="sm"
          value={subTab}
          onChange={setSubTab}
          options={availableSubTabs}
        />
      </div>

      {/* 4A. ACTIVITY TAB (Matches Screenshot 2: Search + Filter + + New + Date-Grouped Cards) */}
      {subTab === 'activity' && (
        <Card padding="none">
          <div className="p-5 space-y-4">
            {/* Activity Header + "+ New" button */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activity</h2>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setNewEntryOpen(true)}
              >
                New
              </Button>
            </div>

            {/* Search + Filter Toolbar */}
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

            {/* Floating Bulk Bar when entries are checked */}
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
                      setSelectedIds(new Set());
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}

            {/* Table Column Header Strip: DATE | AMOUNT */}
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

            {/* Date-Grouped Entry Cards (Screenshot 2) */}
            {groupedDates.length === 0 ? (
              <div className="py-10">
                <EmptyState
                  title="No matching entries"
                  description={`No ledger entries found in ${activeAccount.name} for the current filter.`}
                  action={
                    <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewEntryOpen(true)}>
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
                      {/* Date Group Header */}
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

                      {/* Date Group Rows */}
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
                                onClick={() => openInspector(entry)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openInspector(entry);
                                  }
                                }}
                                className={`grid grid-cols-12 items-center gap-2 px-3.5 py-3 hover:bg-[var(--bg-surface-hover)]/70 cursor-pointer transition-colors ${
                                  entry.excluded ? 'opacity-65' : ''
                                }`}
                              >
                                {/* Left: Checkbox + Monogram/Icon + Name/Subtitle */}
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

                                {/* Center-Left: Category / Entry Type Pill */}
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

                                {/* Center-Right: Tags & Lock/Matched Indicator */}
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

                                {/* Right: Amount */}
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
      )}

      {/* 4B. STATEMENTS & METADATA TAB */}
      {subTab === 'statements' && (
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
                    onClick={() => {
                      setReconciledBalance(activeAccount.balance);
                      setReconcileOpen(true);
                    }}
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
              <DetailRow label="Classification" value={GROUP_LABELS[activeAccount.accountType] || activeAccount.accountType} />
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
                onClick={() => {
                  setReconciledBalance(activeAccount.balance);
                  setReconcileOpen(true);
                }}
              >
                Anchor Balance Valuation
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 4C. PORTFOLIO HOLDINGS TAB (INVESTMENT / CRYPTO) */}
      {subTab === 'holdings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card padding="sm">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                Market Value
              </div>
              <div className="text-lg font-bold mt-1">
                <MoneyAmount
                  value={holdingsData?.totalMarketValue ?? '0.0000'}
                  currency={activeAccount.currency}
                />
              </div>
            </Card>
            <Card padding="sm">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                Cost Basis
              </div>
              <div className="text-lg font-bold mt-1">
                <MoneyAmount
                  value={holdingsData?.totalCostBasis ?? '0.0000'}
                  currency={activeAccount.currency}
                />
              </div>
            </Card>
            <Card padding="sm">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                Unrealized Gain
              </div>
              <div
                className={`text-lg font-bold mt-1 ${
                  Number(holdingsData?.totalGain ?? 0) >= 0
                    ? 'text-[var(--status-positive)]'
                    : 'text-[var(--status-negative)]'
                }`}
              >
                <MoneyAmount
                  value={holdingsData?.totalGain ?? '0.0000'}
                  currency={activeAccount.currency}
                  showSign
                />
              </div>
            </Card>
            <Card padding="sm">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                Total Return
              </div>
              <div
                className={`text-lg font-bold mt-1 font-mono-tabular ${
                  Number(holdingsData?.totalReturnPercent ?? 0) >= 0
                    ? 'text-[var(--status-positive)]'
                    : 'text-[var(--status-negative)]'
                }`}
              >
                {Number(holdingsData?.totalReturnPercent ?? 0) >= 0 ? '+' : ''}
                {Number(holdingsData?.totalReturnPercent ?? 0).toFixed(2)}%
              </div>
            </Card>
          </div>

          <Card title="Positions & Allocation">
            {holdingsLoading ? (
              <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
                Loading positions...
              </div>
            ) : !holdingsData || holdingsData.holdings.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
                No securities recorded yet. Add your first ticker below.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Ticker</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium">Avg Cost</th>
                      <th className="text-right px-3 py-2 font-medium">Price</th>
                      <th className="text-right px-3 py-2 font-medium">Market Value</th>
                      <th className="text-right px-3 py-2 font-medium">Gain (%)</th>
                      <th className="text-right px-3 py-2 font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {holdingsData.holdings.map((h) => {
                      const isUp = Number(h.unrealizedGain) >= 0;
                      return (
                        <tr key={h.id}>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-[var(--text-primary)]">{h.ticker}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{h.securityName}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono-tabular">
                            {Number(h.qty).toFixed(4)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <MoneyAmount value={h.avgCostBasis} currency={h.currency} />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <MoneyAmount value={h.currentPrice} currency={h.currency} />
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold">
                            <MoneyAmount value={h.marketValue} currency={h.currency} />
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-mono-tabular text-xs ${
                              isUp ? 'text-[var(--status-positive)]' : 'text-[var(--status-negative)]'
                            }`}
                          >
                            <MoneyAmount
                              value={h.unrealizedGain}
                              currency={h.currency}
                              showSign
                            />{' '}
                            ({isUp ? '+' : ''}
                            {Number(h.returnPercent).toFixed(2)}%)
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono-tabular text-xs">
                            {Number(h.portfolioWeightPercent).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Add / Update Position" subtitle="Persists cost basis, share quantity & live valuation">
            <form onSubmit={handleAddHolding} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Ticker
                </label>
                <input
                  type="text"
                  required
                  value={holdingTicker}
                  onChange={(e) => setHoldingTicker(e.target.value)}
                  placeholder="VTI / BTC"
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Security Name
                </label>
                <input
                  type="text"
                  value={holdingName}
                  onChange={(e) => setHoldingName(e.target.value)}
                  placeholder="Vanguard Total Market"
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Quantity
                </label>
                <input
                  type="text"
                  required
                  value={holdingQty}
                  onChange={(e) => setHoldingQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                />
              </div>
              <MoneyField
                label="Avg Cost"
                value={holdingCost}
                onChange={setHoldingCost}
                currency={activeAccount.currency}
              />
              <MoneyField
                label="Current Price"
                value={holdingPrice}
                onChange={setHoldingPrice}
                currency={activeAccount.currency}
              />
              <Button type="submit" icon={<Plus className="w-4 h-4" />}>
                Save Position
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* 4D. LOAN AMORTIZATION SIMULATOR TAB (LOAN) */}
      {subTab === 'loan' && loanSchedule && (
        <Card title="Loan Payoff Simulator" subtitle="Interactive Decimal-precision amortization schedule">
          <div className="space-y-4">
            <div className="max-w-md">
              <MoneyField
                label="Extra Monthly Principal Payment"
                value={extraPayment}
                onChange={setExtraPayment}
                currency={activeAccount.currency}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                <div className="text-xs text-[var(--text-secondary)]">Standard Payment</div>
                <div className="text-lg font-bold mt-1">
                  <MoneyAmount
                    value={loanSchedule.monthlyScheduledPayment}
                    currency={activeAccount.currency}
                  />
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                <div className="text-xs text-[var(--text-secondary)]">Payoff Horizon</div>
                <div className="text-lg font-bold font-mono-tabular mt-1">
                  {loanSchedule.payoffMonths} months
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                <div className="text-xs text-[var(--text-secondary)]">Months Saved</div>
                <div className="text-lg font-bold font-mono-tabular text-[var(--status-positive)] mt-1">
                  {loanSchedule.monthsSaved} months
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                <div className="text-xs text-[var(--text-secondary)]">Interest Saved</div>
                <div className="text-lg font-bold text-[var(--status-positive)] mt-1">
                  <MoneyAmount value={loanSchedule.interestSaved} currency={activeAccount.currency} />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-lg border border-[var(--border-primary)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Month</th>
                    <th className="text-right px-3 py-2 font-medium">Principal</th>
                    <th className="text-right px-3 py-2 font-medium">Interest</th>
                    <th className="text-right px-3 py-2 font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {loanSchedule.schedule.slice(0, 24).map((row) => (
                    <tr key={row.month}>
                      <td className="px-3 py-2 font-mono-tabular">#{row.month}</td>
                      <td className="px-3 py-2 text-right text-[var(--status-positive)]">
                        <MoneyAmount value={row.principalPaid} currency={activeAccount.currency} />
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--status-warning)]">
                        <MoneyAmount value={row.interestPaid} currency={activeAccount.currency} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        <MoneyAmount
                          value={row.remainingBalance}
                          currency={activeAccount.currency}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* 5. Entry Inspector Drawer (Matches Sure Screenshot 3: Large Amount Header + OVERVIEW / DETAILS / SETTINGS Disclosures) */}
      <SlideOverDrawer
        open={Boolean(inspectingEntry)}
        onClose={() => setInspectingId(null)}
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
                  setInspectingId(null);
                }
              }}
            >
              Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setInspectingId(null)}>
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

      {/* 6. New Entry Modal (Pre-scoped to Active Account) */}
      {activeAccount && (
        <Dialog
          open={newEntryOpen}
          onClose={() => setNewEntryOpen(false)}
          title={`New Entry — ${activeAccount.name}`}
          description="Creates a ledger entry and materializes updated daily account balances."
          footer={
            <>
              <Button variant="secondary" onClick={() => setNewEntryOpen(false)}>
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
      )}

      {/* 7. Reconcile Anchor Valuation Modal */}
      {activeAccount && (
        <Dialog
          open={reconcileOpen}
          onClose={() => setReconcileOpen(false)}
          title={`Reconcile Balance Valuation — ${activeAccount.name}`}
          description="Creates a RECONCILIATION Valuation entry and anchors daily snapshots."
          footer={
            <>
              <Button variant="secondary" onClick={() => setReconcileOpen(false)}>
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
      )}
        </>
      )}

      {/* 8. Create Account Modal */}
      <Dialog
        open={createAccountOpen}
        onClose={() => setCreateAccountOpen(false)}
        title="Create Account"
        description="Supports all 9 Sure account classifications with automatic opening valuation."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateAccountOpen(false)}>
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
    </div>
  );
};
