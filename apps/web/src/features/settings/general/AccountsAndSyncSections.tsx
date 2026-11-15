import React, { useMemo, useState } from 'react';
import { AccountType, sumMoney } from '@sure/shared';
import {
  Button,
  Card,
  CategoryIcon,
  Dialog,
  IconPicker,
  MoneyAmount,
  MoneyField,
  Pill,
  SearchInput,
  SegmentedControl,
} from '@sure/ui';
import {
  ArrowRight,
  ExternalLink,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useLedger, WebAccount } from '../../../lib/ledger-context.js';

const ACCOUNT_GROUP_LABELS: Record<string, string> = {
  DEPOSITORY: 'Cash',
  INVESTMENT: 'Investments',
  CRYPTO: 'Crypto',
  PROPERTY: 'Properties',
  VEHICLE: 'Vehicles',
  OTHER_ASSET: 'Other Assets',
  CREDIT_CARD: 'Credit Cards',
  LOAN: 'Loans & Mortgages',
  OTHER_LIABILITY: 'Other Liabilities',
};

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

function formatAccountSubtype(acc: WebAccount): string {
  const details = acc.subtypeDetails ?? {};
  const raw =
    typeof details.accountSubtype === 'string'
      ? details.accountSubtype
      : typeof details.loanSubtype === 'string'
        ? details.loanSubtype
        : typeof details.propertyType === 'string'
          ? details.propertyType
          : typeof details.walletType === 'string'
            ? details.walletType
            : acc.accountType;
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const AccountsSettingsSection: React.FC<{
  onOpenAccount?: (accountId: string) => void;
  createAccOpen: boolean;
  onCloseCreateAcc: () => void;
}> = ({ onOpenAccount, createAccOpen, onCloseCreateAcc }) => {
  const { family, accounts, syncConnections, createAccount, deleteAccount } = useLedger();

  const [accountMenuId, setAccountMenuId] = useState<string | null>(null);
  const [newAccType, setNewAccType] = useState<AccountType>('DEPOSITORY');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccBalance, setNewAccBalance] = useState<string>('0.00');
  const [newAccColor, setNewAccColor] = useState<string>('#078C52');
  const [newAccIcon, setNewAccIcon] = useState<string>('Wallet');

  const groupedAccounts = useMemo(() => {
    const map = new Map<string, WebAccount[]>();
    for (const acc of accounts) {
      const list = map.get(acc.accountType) ?? [];
      list.push(acc);
      map.set(acc.accountType, list);
    }
    return Array.from(map.entries()).map(([type, list]) => ({
      type,
      label: ACCOUNT_GROUP_LABELS[type] || type,
      accounts: list,
      total: sumMoney(list.map((a) => a.balance)),
    }));
  }, [accounts]);

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
    onCloseCreateAcc();
  };

  return (
    <div className="space-y-4">
      {syncConnections.length > 0 && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
                  {syncConnections[0]!.institutionName.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {syncConnections[0]!.institutionName}
                </span>
              </div>
              <Pill label={`${syncConnections.length} linked`} color="#078C52" size="xs" />
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Connected institutions sync transactions, balances, and holdings into your household ledger.
            </p>
          </div>
        </Card>
      )}

      <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)]">
            <Layers className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Family accounts
          </span>
        </div>

        {groupedAccounts.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
            No accounts added yet. Click <strong>New account</strong> above to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {groupedAccounts.map((group) => (
              <div
                key={group.type}
                className="rounded-xl border border-[var(--border-primary)] overflow-hidden bg-[var(--bg-surface)]"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">
                    {group.label} <span className="text-[var(--text-muted)]">•</span>{' '}
                    {group.accounts.length}
                  </span>
                  <span className="font-mono-tabular font-medium text-[var(--text-secondary)]">
                    <MoneyAmount value={group.total} currency={family.baseCurrency} />
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-primary)]">
                  {group.accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="relative flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)]/60 transition-colors"
                    >
                      <div
                        role={onOpenAccount ? 'button' : undefined}
                        tabIndex={onOpenAccount ? 0 : undefined}
                        onClick={() => onOpenAccount?.(acc.id)}
                        onKeyDown={(e) => {
                          if (onOpenAccount && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onOpenAccount(acc.id);
                          }
                        }}
                        className={`flex items-center gap-3 min-w-0 flex-1 ${
                          onOpenAccount ? 'cursor-pointer' : ''
                        }`}
                      >
                        <CategoryIcon
                          icon={acc.icon || 'Wallet'}
                          label={acc.name}
                          color={acc.color}
                          variant="circle"
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {acc.name}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] truncate">
                            {formatAccountSubtype(acc)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          <MoneyAmount value={acc.balance} currency={acc.currency} />
                        </span>
                        <button
                          type="button"
                          aria-label={`Actions for ${acc.name}`}
                          onClick={() =>
                            setAccountMenuId((cur) => (cur === acc.id ? null : acc.id))
                          }
                          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {accountMenuId === acc.id && (
                          <div className="absolute right-4 top-11 z-20 w-44 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-lg p-1.5 space-y-0.5">
                            {onOpenAccount && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAccountMenuId(null);
                                  onOpenAccount(acc.id);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer text-[var(--text-primary)]"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                <span>Open account ledger</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setAccountMenuId(null);
                                void deleteAccount(acc.id);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-red-500/10 text-left cursor-pointer text-[var(--status-negative)]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete account</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Account Modal */}
      <Dialog
        open={createAccOpen}
        onClose={onCloseCreateAcc}
        title="New Account"
        description="Supports all 9 Sure account classifications with automatic opening valuation."
        footer={
          <>
            <Button variant="secondary" onClick={onCloseCreateAcc}>
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
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACCOUNT_GROUP_LABELS[type] || type} ({type})
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
              placeholder="e.g., Apple Card, Chase Sapphire Reserve"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            />
          </div>

          <MoneyField
            label="Opening Valuation Balance"
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

export const BankSyncSettingsSection: React.FC<{
  syncBusy: boolean;
  onSyncAll: () => Promise<void>;
}> = ({ syncBusy, onSyncAll }) => {
  const { syncAdapters, syncConnections, connectProvider } = useLedger();

  const [providerSearch, setProviderSearch] = useState<string>('');
  const [providerCategory, setProviderCategory] = useState<
    'ALL' | 'BANKS' | 'CRYPTO' | 'INVESTMENTS'
  >('ALL');
  const [connectingAdapter, setConnectingAdapter] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [institutionDraft, setInstitutionDraft] = useState<string>('');

  const filteredAdapters = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return syncAdapters.filter((adapter) => {
      const cat =
        adapter.category === 'CRYPTO'
          ? 'CRYPTO'
          : adapter.category === 'BROKERAGE' || adapter.category === 'MARKET_DATA'
            ? 'INVESTMENTS'
            : 'BANKS';
      if (providerCategory !== 'ALL' && cat !== providerCategory) return false;
      if (!q) return true;
      return (
        adapter.name.toLowerCase().includes(q) ||
        adapter.category.toLowerCase().includes(q) ||
        adapter.regions.join(' ').toLowerCase().includes(q) ||
        adapter.key.toLowerCase().includes(q)
      );
    });
  }, [syncAdapters, providerSearch, providerCategory]);

  return (
    <div className="space-y-6">
      {syncConnections.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            YOUR CONNECTIONS <span className="mx-1">•</span> {syncConnections.length}
          </div>
          <div className="space-y-3">
            {syncConnections.map((conn) => (
              <div
                key={conn.id}
                className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
                      {conn.institutionName.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {conn.institutionName}
                        </span>
                        <Pill label="Beta" color="#64748b" size="xs" />
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        Provider adapter: {conn.providerName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Pill label={`• ${conn.status || 'Sync active'}`} color="#078C52" size="xs" />
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />}
                      disabled={syncBusy}
                      onClick={() => void onSyncAll()}
                    >
                      Sync
                    </Button>
                  </div>
                </div>

                <div className="divide-y divide-[var(--border-primary)] text-xs pt-1">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[var(--text-secondary)]">Last accepted by Sure</span>
                    <span className="font-mono-tabular text-[var(--text-primary)]">
                      {conn.lastSyncedAt ? conn.lastSyncedAt.slice(0, 16).replace('T', ' ') : 'Pending initial sync'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[var(--text-secondary)]">Connected timestamp</span>
                    <span className="font-mono-tabular text-[var(--text-primary)]">
                      {conn.createdAt.slice(0, 10)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={providerSearch}
          onChange={setProviderSearch}
          placeholder="Search providers..."
          shortcutHint=""
          className="flex-1 min-w-[220px]"
        />
        <SegmentedControl
          size="sm"
          value={providerCategory}
          onChange={setProviderCategory}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'BANKS', label: 'Banks' },
            { value: 'CRYPTO', label: 'Crypto' },
            { value: 'INVESTMENTS', label: 'Investments' },
          ]}
        />
      </div>

      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          AVAILABLE <span className="mx-1">•</span> {filteredAdapters.length}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredAdapters.map((adapter) => {
            const regionsText = adapter.regions.length > 0 ? adapter.regions.join(', ') : 'Global';
            const categoryLabel =
              adapter.category === 'BANKING'
                ? 'Bank'
                : adapter.category === 'CRYPTO'
                  ? 'Crypto'
                  : adapter.category === 'BROKERAGE'
                    ? 'Investments'
                    : 'Market Data';
            return (
              <div
                key={adapter.key}
                className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-primary)] shrink-0">
                      {adapter.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {adapter.name}
                        </span>
                        <Pill
                          label={adapter.supportsWebhooks ? 'Webhook' : 'Beta'}
                          color="#64748b"
                          size="xs"
                        />
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {regionsText} • {categoryLabel}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Sync {adapter.name} balances, holdings, and historical activity into your household ledger.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectingAdapter({ key: adapter.key, label: adapter.name });
                      setInstitutionDraft(adapter.name);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] hover:underline cursor-pointer"
                  >
                    <span>Connect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect Bank Sync Provider Modal */}
      <Dialog
        open={Boolean(connectingAdapter)}
        onClose={() => setConnectingAdapter(null)}
        title={`Connect ${connectingAdapter?.label ?? 'Provider'}`}
        description="Creates an external financial provider connection and syncs balances."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConnectingAdapter(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!connectingAdapter) return;
                await connectProvider({
                  providerKey: connectingAdapter.key,
                  institutionName: institutionDraft.trim() || connectingAdapter.label,
                });
                setConnectingAdapter(null);
              }}
            >
              Connect Provider
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Institution Display Name
          </label>
          <input
            type="text"
            value={institutionDraft}
            onChange={(e) => setInstitutionDraft(e.target.value)}
            placeholder="e.g., Chase Bank, Coinbase Prime"
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
        </div>
      </Dialog>
    </div>
  );
};
