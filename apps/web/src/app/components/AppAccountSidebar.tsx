import React, { useMemo, useState } from 'react';
import { addMoney } from '@sure/shared';
import {
  Button,
  CategoryIcon,
  MoneyAmount,
  SegmentedControl,
  Sparkline,
} from '@sure/ui';
import { ChevronRight, ChevronsUpDown, Plus } from 'lucide-react';
import type { WebAccount } from '../../lib/ledger-context.js';
import {
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_GROUP_META,
  type NavTabId,
  type SidebarFilter,
} from './navigation.js';

function normalizeSparkline(raw: number[], currentBalance: string): number[] {
  if (raw.length >= 2) return raw;
  const val = raw[0] ?? Number(currentBalance);
  return [val, val];
}

function sumSparklines(accounts: WebAccount[]): number[] {
  const maxLen = Math.max(2, ...accounts.map((a) => a.sparkline.length));
  const result = new Array<number>(maxLen).fill(0);
  for (const acc of accounts) {
    const pts = normalizeSparkline(acc.sparkline, acc.balance);
    for (let i = 0; i < maxLen; i++) {
      const mappedIdx =
        pts.length === maxLen
          ? i
          : Math.round((i / Math.max(1, maxLen - 1)) * (pts.length - 1));
      result[i] = (result[i] ?? 0) + (pts[mappedIdx] ?? 0);
    }
  }
  return result;
}

function formatAccountSubtype(acc: WebAccount): string {
  const rawSubtype = acc.subtypeDetails?.accountSubtype;
  if (typeof rawSubtype === 'string' && rawSubtype.trim()) {
    return rawSubtype
      .toLowerCase()
      .split('_')
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  const defaults: Record<string, string> = {
    DEPOSITORY: 'Cash',
    INVESTMENT: 'Brokerage',
    CRYPTO: 'Crypto',
    PROPERTY: 'Property',
    VEHICLE: 'Vehicle',
    OTHER_ASSET: 'Other Asset',
    CREDIT_CARD: 'Credit Card',
    LOAN: 'Loan',
    OTHER_LIABILITY: 'Other Debt',
  };
  return defaults[acc.accountType] ?? acc.accountType;
}

const SidebarTrendMetric: React.FC<{
  value: string;
  currency: string;
  sparkline: number[];
}> = ({ value, currency, sparkline }) => {
  const [hoveredVal, setHoveredVal] = useState<number | null>(null);
  const points = normalizeSparkline(sparkline, value);
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const pct = Math.abs(first) >= 0.01 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const isFlat = Math.abs(pct) < 0.05;
  const isPositive = pct >= 0;
  const trendColor = isFlat ? '#71717a' : isPositive ? '#078C52' : '#E24056';

  return (
    <div className="shrink-0 flex flex-col items-end">
      <div
        className={`text-xs font-mono-tabular font-medium ${
          hoveredVal !== null
            ? 'text-[var(--text-primary)] underline decoration-dotted'
            : 'text-[var(--text-primary)]'
        }`}
      >
        <MoneyAmount
          value={hoveredVal !== null ? hoveredVal.toFixed(2) : value}
          currency={currency}
        />
      </div>
      <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
        <Sparkline
          data={points}
          width={42}
          height={13}
          color={trendColor}
          interactive
          onHoverPoint={(pt) => setHoveredVal(pt ? pt.value : null)}
        />
        <span
          className="text-[10px] font-mono-tabular font-medium min-w-[34px] text-right"
          style={{ color: trendColor }}
        >
          {isFlat ? '0.0%' : `${pct.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
};

interface AppAccountSidebarProps {
  familyName: string;
  baseCurrency: string;
  memberCount: number;
  userName?: string;
  userRole?: string;
  accounts: WebAccount[];
  activeTab: NavTabId;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  onNavigate: (tab: NavTabId) => void;
  onCloseMobile: () => void;
}

export const AppAccountSidebar: React.FC<AppAccountSidebarProps> = ({
  familyName,
  baseCurrency,
  memberCount,
  userName,
  userRole,
  accounts,
  activeTab,
  selectedAccountId,
  onSelectAccount,
  onNavigate,
  onCloseMobile,
}) => {
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groupedAccounts = useMemo(() => {
    const filtered = accounts.filter((acc) => {
      if (sidebarFilter === 'ASSET') return acc.classification === 'ASSET';
      if (sidebarFilter === 'LIABILITY') return acc.classification === 'LIABILITY';
      return true;
    });

    const map = new Map<
      string,
      { type: string; label: string; accounts: WebAccount[]; total: string; sparkline: number[] }
    >();
    for (const acc of filtered) {
      const existing = map.get(acc.accountType);
      if (existing) {
        existing.accounts.push(acc);
        existing.total = addMoney(existing.total, acc.balance);
      } else {
        map.set(acc.accountType, {
          type: acc.accountType,
          label: ACCOUNT_GROUP_LABELS[acc.accountType] ?? acc.accountType,
          accounts: [acc],
          total: acc.balance,
          sparkline: [],
        });
      }
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.sparkline = sumSparklines(g.accounts);
    }
    return groups;
  }, [accounts, sidebarFilter]);

  const allGroupsCollapsed =
    groupedAccounts.length > 0 && groupedAccounts.every((g) => Boolean(collapsedGroups[g.type]));

  const toggleAllGroups = () => {
    const nextState: Record<string, boolean> = {};
    for (const g of groupedAccounts) {
      nextState[g.type] = !allGroupsCollapsed;
    }
    setCollapsedGroups(nextState);
  };

  return (
    <div className="flex flex-col h-full justify-between p-4 gap-4">
      <div className="space-y-4 overflow-y-auto pr-0.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {familyName}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {accounts.length} accounts • {baseCurrency}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              onNavigate('accounts');
              onCloseMobile();
            }}
          >
            New
          </Button>
        </div>

        <div className="space-y-2.5">
          <div className="w-full">
            <SegmentedControl<SidebarFilter>
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'ASSET', label: 'Assets' },
                { value: 'LIABILITY', label: 'Debts' },
              ]}
              value={sidebarFilter}
              onChange={setSidebarFilter}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                onNavigate('accounts');
                onCloseMobile();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {sidebarFilter === 'ASSET'
                  ? 'New asset'
                  : sidebarFilter === 'LIABILITY'
                    ? 'New debt'
                    : 'New account'}
              </span>
            </button>

            {groupedAccounts.length > 0 && (
              <button
                type="button"
                onClick={toggleAllGroups}
                className="p-1 rounded-md border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label={allGroupsCollapsed ? 'Expand all groups' : 'Collapse all groups'}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {groupedAccounts.length === 0 ? (
            <div className="py-8 px-3 text-center text-xs text-[var(--text-secondary)] rounded-lg border border-dashed border-[var(--border-primary)]">
              No accounts in this filter yet.
            </div>
          ) : (
            groupedAccounts.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.type]);
              const meta = ACCOUNT_GROUP_META[group.type] ?? {
                icon: 'Wallet',
                color: '#6b7280',
              };
              return (
                <div key={group.type} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2 px-1.5 py-1 rounded-lg hover:bg-[var(--bg-surface-hover)]/60">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [group.type]: !isCollapsed,
                        }))
                      }
                      className="flex items-center gap-1.5 min-w-0 pt-0.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer text-left"
                    >
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                          isCollapsed ? '' : 'rotate-90'
                        }`}
                      />
                      <CategoryIcon
                        icon={meta.icon}
                        label={group.label}
                        color={meta.color}
                        variant="inline"
                        size="xs"
                      />
                      <span className="truncate">{group.label}</span>
                    </button>

                    <SidebarTrendMetric
                      value={group.total}
                      currency={baseCurrency}
                      sparkline={group.sparkline}
                    />
                  </div>

                  {!isCollapsed && (
                    <div className="pl-2 space-y-1">
                      {group.accounts.map((acc) => {
                        const isSelectedAccount =
                          activeTab === 'accounts' &&
                          (selectedAccountId
                            ? selectedAccountId === acc.id
                            : accounts[0]?.id === acc.id);
                        return (
                          <div
                            key={acc.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              onSelectAccount(acc.id);
                              onNavigate('accounts');
                              onCloseMobile();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelectAccount(acc.id);
                                onNavigate('accounts');
                                onCloseMobile();
                              }
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                              isSelectedAccount
                                ? 'bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-xs'
                                : 'border border-transparent hover:bg-[var(--bg-surface-hover)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CategoryIcon
                                icon={acc.icon || meta.icon}
                                label={acc.name}
                                color={acc.color || meta.color}
                                variant="circle"
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                                  {acc.name}
                                </div>
                                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                                  {formatAccountSubtype(acc)}
                                </div>
                              </div>
                            </div>

                            <SidebarTrendMetric
                              value={acc.balance}
                              currency={acc.currency}
                              sparkline={acc.sparkline}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--border-primary)] flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0">
          <div className="font-medium text-[var(--text-primary)] truncate">{userName}</div>
          <div className="text-[11px] text-[var(--text-secondary)] truncate">
            {userRole} • {memberCount} members
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onNavigate('settings');
            onCloseMobile();
          }}
          className="px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
        >
          Manage
        </button>
      </div>
    </div>
  );
};
