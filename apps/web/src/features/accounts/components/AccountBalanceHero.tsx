import React, { useMemo } from 'react';
import {
  absMoney,
  compareMoney,
  divMoney,
  formatCurrency,
  isZeroMoney,
  mulMoney,
  subMoney,
} from '@sure/shared';
import {
  Button,
  Card,
  CategoryIcon,
  MoneyAmount,
  ResponsiveAreaChart,
  SegmentedControl,
} from '@sure/ui';
import { MoreHorizontal, Plus, Scale, Trash2 } from 'lucide-react';
import { WebAccount, WebEntry } from '../../../lib/ledger-context.js';
import {
  buildAccountHistorySeries,
  formatSubtypeLabel,
  TIMEFRAME_LABELS,
  TIMEFRAME_OPTIONS,
  TimeframeKey,
} from './accountHistory.js';

export const AccountBalanceHero: React.FC<{
  accounts: WebAccount[];
  activeAccount: WebAccount;
  accountEntries: WebEntry[];
  timeframe: TimeframeKey;
  onTimeframeChange: (tf: TimeframeKey) => void;
  actionsMenuOpen: boolean;
  onToggleActionsMenu: () => void;
  onCloseActionsMenu: () => void;
  onSelectAccount?: (accountId: string) => void;
  onOpenReconcile: () => void;
  onOpenCreateAccount: () => void;
  onOpenNewEntry: () => void;
  onDeleteAccount: (accountId: string) => void;
}> = ({
  accounts,
  activeAccount,
  accountEntries,
  timeframe,
  onTimeframeChange,
  actionsMenuOpen,
  onToggleActionsMenu,
  onCloseActionsMenu,
  onSelectAccount,
  onOpenReconcile,
  onOpenCreateAccount,
  onOpenNewEntry,
  onDeleteAccount,
}) => {
  const chartSeries = useMemo(
    () => buildAccountHistorySeries(activeAccount, accountEntries, timeframe),
    [activeAccount, accountEntries, timeframe]
  );

  const balanceMetrics = useMemo(() => {
    if (chartSeries.length === 0) {
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
  }, [activeAccount.classification, chartSeries]);

  return (
    <>
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
            onClick={onOpenReconcile}
          >
            Reconcile
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenCreateAccount}
          >
            New account
          </Button>
          <button
            type="button"
            onClick={onToggleActionsMenu}
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
                  onCloseActionsMenu();
                  onOpenReconcile();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer text-[var(--text-primary)]"
              >
                <Scale className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Reconcile Anchor Valuation</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseActionsMenu();
                  onOpenNewEntry();
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
                  onCloseActionsMenu();
                  onDeleteAccount(activeAccount.id);
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
            onChange={onTimeframeChange}
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
    </>
  );
};
