import React, { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, SegmentedControl } from '@sure/ui';
import { Plus } from 'lucide-react';
import { useLedger, WebEntry, WebHoldingsSummary } from '../../lib/ledger-context.js';
import { AccountSubTab, TimeframeKey } from './components/accountHistory.js';
import { AccountBalanceHero } from './components/AccountBalanceHero.js';
import { AccountActivityTab } from './components/AccountActivityTab.js';
import { AccountStatementsTab } from './components/AccountStatementsTab.js';
import {
  AccountHoldingsTab,
  AccountLoanTab,
} from './components/AccountHoldingsAndLoanTabs.js';
import {
  CreateAccountDialog,
  EntryInspectorDrawer,
  NewAccountEntryDialog,
  ReconcileBalanceDialog,
} from './components/AccountEntryDialogs.js';

export interface AccountsViewProps {
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  selectedAccountId,
  onSelectAccount,
}) => {
  const {
    accounts,
    entries,
    deleteAccount,
    fetchAccountHoldings,
  } = useLedger();

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId]
  );

  const [timeframe, setTimeframe] = useState<TimeframeKey>('30D');
  const [subTab, setSubTab] = useState<AccountSubTab>('activity');
  const [actionsMenuOpen, setActionsMenuOpen] = useState<boolean>(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [newEntryOpen, setNewEntryOpen] = useState<boolean>(false);
  const [reconcileOpen, setReconcileOpen] = useState<boolean>(false);
  const [createAccountOpen, setCreateAccountOpen] = useState<boolean>(false);

  const [holdingsData, setHoldingsData] = useState<WebHoldingsSummary | null>(null);
  const [holdingsLoading, setHoldingsLoading] = useState<boolean>(false);

  useEffect(() => {
    setSelectedIds(new Set());
    setInspectingId(null);
    setActionsMenuOpen(false);
    setHoldingsData(null);
    if (!activeAccount) return;
    setSubTab((current) => {
      if (
        current === 'holdings' &&
        activeAccount.accountType !== 'INVESTMENT' &&
        activeAccount.accountType !== 'CRYPTO'
      ) {
        return 'activity';
      }
      if (current === 'loan' && activeAccount.accountType !== 'LOAN') {
        return 'activity';
      }
      return current;
    });
  }, [activeAccount?.id]);

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

  const accountEntries = useMemo(() => {
    if (!activeAccount) return [];
    return entries
      .filter((e) => e.accountId === activeAccount.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, activeAccount]);

  const inspectingEntry = useMemo<WebEntry | null>(
    () => entries.find((e) => e.id === inspectingId) ?? null,
    [entries, inspectingId]
  );

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
          <AccountBalanceHero
            accounts={accounts}
            activeAccount={activeAccount}
            accountEntries={accountEntries}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            actionsMenuOpen={actionsMenuOpen}
            onToggleActionsMenu={() => setActionsMenuOpen((v) => !v)}
            onCloseActionsMenu={() => setActionsMenuOpen(false)}
            onSelectAccount={onSelectAccount}
            onOpenReconcile={() => setReconcileOpen(true)}
            onOpenCreateAccount={() => setCreateAccountOpen(true)}
            onOpenNewEntry={() => setNewEntryOpen(true)}
            onDeleteAccount={(id) => void deleteAccount(id)}
          />

          <div className="flex items-center justify-between gap-3">
            <SegmentedControl
              size="sm"
              value={subTab}
              onChange={setSubTab}
              options={availableSubTabs}
            />
          </div>

          {subTab === 'activity' && (
            <AccountActivityTab
              activeAccount={activeAccount}
              accountEntries={accountEntries}
              selectedIds={selectedIds}
              onChangeSelectedIds={setSelectedIds}
              onInspectEntry={(entry) => setInspectingId(entry.id)}
              onOpenNewEntry={() => setNewEntryOpen(true)}
            />
          )}

          {subTab === 'statements' && (
            <AccountStatementsTab
              activeAccount={activeAccount}
              accountEntries={accountEntries}
              onOpenReconcile={() => setReconcileOpen(true)}
            />
          )}

          {subTab === 'holdings' && (
            <AccountHoldingsTab
              activeAccount={activeAccount}
              holdingsData={holdingsData}
              holdingsLoading={holdingsLoading}
              onUpdateHoldings={setHoldingsData}
            />
          )}

          {subTab === 'loan' && <AccountLoanTab activeAccount={activeAccount} />}

          <EntryInspectorDrawer
            inspectingEntry={inspectingEntry}
            onClose={() => setInspectingId(null)}
          />

          <NewAccountEntryDialog
            activeAccount={activeAccount}
            open={newEntryOpen}
            onClose={() => setNewEntryOpen(false)}
          />

          <ReconcileBalanceDialog
            activeAccount={activeAccount}
            open={reconcileOpen}
            onClose={() => setReconcileOpen(false)}
          />
        </>
      )}

      <CreateAccountDialog
        open={createAccountOpen}
        onClose={() => setCreateAccountOpen(false)}
      />
    </div>
  );
};
