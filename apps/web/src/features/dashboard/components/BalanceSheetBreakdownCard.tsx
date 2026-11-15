import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CategoryIcon, MoneyAmount, Sparkline } from '@sure/ui';
import type { BalanceGroupRow, MixSegment } from './useDashboardMetrics.js';

interface BalanceSheetBreakdownCardProps {
  open: boolean;
  onToggleOpen: () => void;
  accountCount: number;
  baseCurrency: string;
  totalAssets: string;
  totalLiabilities: string;
  mixSegments: MixSegment[];
  assetGroups: BalanceGroupRow[];
  liabilityGroups: BalanceGroupRow[];
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onNavigateAccounts: () => void;
}

export const BalanceSheetBreakdownCard: React.FC<BalanceSheetBreakdownCardProps> = ({
  open,
  onToggleOpen,
  accountCount,
  baseCurrency,
  totalAssets,
  totalLiabilities,
  mixSegments,
  assetGroups,
  liabilityGroups,
  expandedGroups,
  onToggleGroup,
  onNavigateAccounts,
}) => {
  const renderGroupRows = (groups: BalanceGroupRow[]) =>
    groups.map((group) => {
      const groupOpen = Boolean(expandedGroups[group.key]);
      return (
        <div
          key={group.key}
          className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] overflow-hidden"
        >
          <button
            type="button"
            onClick={() => onToggleGroup(group.key)}
            className="w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-sm hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
          >
            <div className="col-span-6 flex items-center gap-2 text-left min-w-0">
              {groupOpen ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              )}
              <CategoryIcon
                icon={group.icon}
                label={group.label}
                color={group.color}
                variant="circle"
                size="xs"
              />
              <span className="font-medium text-[var(--text-primary)] truncate">{group.label}</span>
              <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
                ({group.accounts.length})
              </span>
            </div>
            <div className="col-span-3 text-right font-mono-tabular text-xs text-[var(--text-secondary)]">
              {group.weightPercent}%
            </div>
            <div className="col-span-3 text-right font-mono-tabular font-semibold">
              <MoneyAmount value={group.total} currency={baseCurrency} />
            </div>
          </button>

          {groupOpen && (
            <div className="border-t border-[var(--border-primary)] divide-y divide-[var(--border-primary)] bg-[var(--bg-surface-subtle)]/40">
              {group.accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={onNavigateAccounts}
                  className="grid grid-cols-12 items-center px-4 py-2 pl-10 text-xs hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
                >
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <CategoryIcon
                      icon={acc.icon || group.icon}
                      label={acc.name}
                      color={acc.color}
                      variant="inline"
                      size="xs"
                    />
                    <span className="truncate font-medium text-[var(--text-primary)]">
                      {acc.name}
                    </span>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <Sparkline data={acc.sparkline} width={64} height={18} color={acc.color} />
                  </div>
                  <div className="col-span-3 text-right font-mono-tabular font-medium">
                    <MoneyAmount value={acc.balance} currency={acc.currency} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });

  return (
    <Card padding="none">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-hover)]/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
          )}
          <span className="text-sm font-semibold text-[var(--text-primary)]">Balance Sheet</span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">{accountCount} active accounts</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-[var(--border-primary)] pt-4">
          {mixSegments.length > 0 && (
            <div className="space-y-2.5">
              <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[var(--bg-surface-subtle)] gap-0.5">
                {mixSegments.map((seg) => (
                  <div
                    key={seg.key}
                    style={{
                      width: `${Math.max(seg.weight, 2)}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${seg.weight.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                {mixSegments.map((seg) => (
                  <div key={seg.key} className="flex items-center gap-1.5">
                    <CategoryIcon
                      icon={seg.icon}
                      label={seg.label}
                      color={seg.color}
                      variant="inline"
                      size="xs"
                    />
                    <span className="text-[var(--text-secondary)]">{seg.label}</span>
                    <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                      {seg.weight.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">Assets</span>
                <span className="text-sm font-mono-tabular font-semibold">
                  <MoneyAmount value={totalAssets} currency={baseCurrency} />
                </span>
              </div>
              <div className="p-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] space-y-1.5">
                <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-3 text-right">Weight</div>
                  <div className="col-span-3 text-right">Value</div>
                </div>
                {assetGroups.length > 0 ? (
                  renderGroupRows(assetGroups)
                ) : (
                  <div className="p-4 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-lg">
                    No asset accounts yet.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">Liabilities</span>
                <span className="text-sm font-mono-tabular font-semibold">
                  <MoneyAmount value={totalLiabilities} currency={baseCurrency} />
                </span>
              </div>
              <div className="p-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] space-y-1.5">
                <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-3 text-right">Weight</div>
                  <div className="col-span-3 text-right">Value</div>
                </div>
                {liabilityGroups.length > 0 ? (
                  renderGroupRows(liabilityGroups)
                ) : (
                  <div className="p-4 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-lg">
                    No liability accounts yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
