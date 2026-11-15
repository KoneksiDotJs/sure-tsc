import React, { useMemo, useState } from 'react';
import { AccountType, sumMoney } from '@sure/shared';
import {
  Alert,
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
  Settings2,
  Trash2,
} from 'lucide-react';
import { useLedger, WebAccount, WebProviderConnection } from '../../../lib/ledger-context.js';
import { MarketAndFxMonitorCards } from './MarketAndFxMonitorCards.js';
import {
  ProviderConfigDialog,
  ProviderConfigModalTarget,
} from './ProviderConfigDialog.js';

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

function describeConnectionConfig(conn: WebProviderConnection): string | null {
  const key = conn.providerKey;
  const cfg = conn.configSummary;
  if (key === 'binance') {
    const keyPart = conn.hasCredentials
      ? `API Key ${conn.maskedApiKey ?? 'configured'}`
      : 'API credentials not configured';
    const netPart = cfg?.useTestnet ? 'Testnet' : 'Spot Mainnet';
    return `${keyPart} • ${netPart}${cfg?.quoteCurrency ? ` • ${cfg.quoteCurrency}` : ''}`;
  }
  if (key === 'yahoo_finance') {
    const tickers = cfg?.tickers ?? [];
    return tickers.length > 0
      ? `Watchlist: ${tickers.slice(0, 6).join(', ')}${tickers.length > 6 ? ` (+${tickers.length - 6})` : ''}`
      : 'Default watchlist + Investment holdings';
  }
  if (key === 'frankfurter_fx') {
    const base = cfg?.baseCurrency || 'IDR';
    const targets = cfg?.targetCurrencies ?? [];
    return `Base ${base} → ${targets.length > 0 ? targets.join(', ') : 'IDR, USD, SGD, EUR, GBP, JPY, AUD, MYR'}`;
  }
  return null;
}

export const BankSyncSettingsSection: React.FC<{
  syncBusy: boolean;
  onSyncAll: () => Promise<void>;
}> = ({ syncBusy, onSyncAll }) => {
  const {
    family,
    accounts,
    syncAdapters,
    syncConnections,
    marketQuotes,
    exchangeRates,
    connectProvider,
    updateProviderConnection,
    deleteProviderConnection,
    syncProviderConnection,
  } = useLedger();

  const [providerSearch, setProviderSearch] = useState<string>('');
  const [providerCategory, setProviderCategory] = useState<
    'LIVE' | 'CRYPTO' | 'INVESTMENTS' | 'ALL'
  >('LIVE');
  const [modalTarget, setModalTarget] = useState<ProviderConfigModalTarget | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    kind: 'success' | 'error';
    title: string;
    text: string;
  } | null>(null);

  const cryptoAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'CRYPTO'),
    [accounts]
  );

  const filteredAdapters = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return syncAdapters.filter((adapter) => {
      if (providerCategory === 'LIVE' && !adapter.supportsLiveSync) return false;
      if (providerCategory === 'CRYPTO' && adapter.category !== 'CRYPTO') return false;
      if (
        providerCategory === 'INVESTMENTS' &&
        adapter.category !== 'BROKERAGE' &&
        adapter.category !== 'MARKET_DATA'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        adapter.name.toLowerCase().includes(q) ||
        adapter.category.toLowerCase().includes(q) ||
        adapter.regions.join(' ').toLowerCase().includes(q) ||
        adapter.key.toLowerCase().includes(q)
      );
    });
  }, [syncAdapters, providerSearch, providerCategory]);

  const handleSyncOne = async (conn: WebProviderConnection) => {
    setActionBanner(null);
    setSyncingConnectionId(conn.id);
    try {
      const res = await syncProviderConnection(conn.id);
      setActionBanner({
        kind: res.ok ? 'success' : 'error',
        title: res.ok ? `${conn.institutionName} Synced` : `${conn.institutionName} Sync Failed`,
        text: res.message,
      });
    } catch (err) {
      setActionBanner({
        kind: 'error',
        title: `${conn.institutionName} Sync Failed`,
        text: err instanceof Error ? err.message : 'Unable to sync connection.',
      });
    } finally {
      setSyncingConnectionId(null);
    }
  };

  const handleDeleteOne = async (conn: WebProviderConnection) => {
    setActionBanner(null);
    try {
      await deleteProviderConnection(conn.id);
      setConfirmDeleteId(null);
      setActionBanner({
        kind: 'success',
        title: 'Connection Removed',
        text: `Removed ${conn.institutionName} (${conn.providerName}). Linked accounts remain in your ledger.`,
      });
    } catch (err) {
      setActionBanner({
        kind: 'error',
        title: 'Delete Failed',
        text: err instanceof Error ? err.message : 'Unable to delete connection.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {actionBanner && (
        <Alert
          variant={actionBanner.kind}
          title={actionBanner.title}
          action={
            <Button size="sm" variant="secondary" onClick={() => setActionBanner(null)}>
              Dismiss
            </Button>
          }
        >
          {actionBanner.text}
        </Alert>
      )}

      {syncConnections.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              YOUR CONNECTIONS <span className="mx-1">•</span> {syncConnections.length}
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={syncBusy}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />}
              onClick={() => void onSyncAll()}
            >
              Sync All
            </Button>
          </div>
          <div className="space-y-3">
            {syncConnections.map((conn) => {
              const configNote = describeConnectionConfig(conn);
              const isRowSyncing = syncingConnectionId === conn.id || syncBusy;
              const isConfirmingDelete = confirmDeleteId === conn.id;
              return (
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
                          <Pill
                            label={conn.supportsLiveSync ? 'Live Sync' : 'Catalog'}
                            color={conn.supportsLiveSync ? '#078C52' : '#64748b'}
                            size="xs"
                          />
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          Provider adapter: {conn.providerName}
                        </div>
                        {configNote && (
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono-tabular">
                            {configNote}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Pill label={`• ${conn.status || 'CONNECTED'}`} color="#078C52" size="xs" />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Settings2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setModalError(null);
                          setModalTarget({
                            mode: 'edit',
                            providerKey: conn.providerKey || conn.providerName,
                            providerLabel: conn.providerName,
                            connection: conn,
                          });
                        }}
                      >
                        Configure
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<RefreshCw className={`w-3.5 h-3.5 ${isRowSyncing ? 'animate-spin' : ''}`} />}
                        disabled={isRowSyncing}
                        onClick={() => void handleSyncOne(conn)}
                      >
                        Sync
                      </Button>
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleDeleteOne(conn)}
                          >
                            Confirm Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${conn.institutionName}`}
                          onClick={() => setConfirmDeleteId(conn.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[var(--status-negative)]" />
                        </Button>
                      )}
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
              );
            })}
          </div>
        </div>
      )}

      <MarketAndFxMonitorCards
        familyBaseCurrency={family.baseCurrency}
        marketQuotes={marketQuotes}
        exchangeRates={exchangeRates}
        syncBusy={syncBusy}
        onRefreshAll={onSyncAll}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={providerSearch}
          onChange={setProviderSearch}
          placeholder="Search providers (Binance, Yahoo, Frankfurter)..."
          shortcutHint=""
          className="flex-1 min-w-[220px]"
        />
        <SegmentedControl
          size="sm"
          value={providerCategory}
          onChange={setProviderCategory}
          options={[
            { value: 'LIVE', label: 'Live Sync' },
            { value: 'CRYPTO', label: 'Crypto' },
            { value: 'INVESTMENTS', label: 'Market & FX' },
            { value: 'ALL', label: 'All' },
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
                          label={adapter.supportsLiveSync ? 'Live Ready' : adapter.supportsWebhooks ? 'Webhook' : 'Catalog'}
                          color={adapter.supportsLiveSync ? '#078C52' : '#64748b'}
                          size="xs"
                        />
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {regionsText} • {categoryLabel}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {adapter.description ||
                      `Sync ${adapter.name} balances, holdings, and historical activity into your household ledger.`}
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setModalError(null);
                      setModalTarget({
                        mode: 'create',
                        providerKey: adapter.key,
                        providerLabel: adapter.name,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] hover:underline cursor-pointer"
                  >
                    <span>Configure &amp; Connect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ProviderConfigDialog
        target={modalTarget}
        familyBaseCurrency={family.baseCurrency}
        cryptoAccounts={cryptoAccounts}
        busy={modalBusy}
        errorText={modalError}
        onClose={() => {
          setModalTarget(null);
          setModalError(null);
        }}
        onSubmit={async (payload) => {
          if (!modalTarget) return;
          setModalError(null);
          setModalBusy(true);
          try {
            if (modalTarget.mode === 'create') {
              await connectProvider({
                providerKey: modalTarget.providerKey,
                institutionName: payload.institutionName,
                ...(payload.accountId ? { accountId: payload.accountId } : {}),
                config: payload.config,
              });
              setActionBanner({
                kind: 'success',
                title: `${payload.institutionName} Connected`,
                text: 'Click Sync on the connection card to fetch live data now.',
              });
            } else if (modalTarget.connection) {
              await updateProviderConnection(modalTarget.connection.id, {
                institutionName: payload.institutionName,
                ...(payload.accountId !== undefined ? { accountId: payload.accountId } : {}),
                config: payload.config,
              });
              setActionBanner({
                kind: 'success',
                title: `${payload.institutionName} Updated`,
                text: 'Connection configuration saved.',
              });
            }
            setModalTarget(null);
          } catch (err) {
            setModalError(err instanceof Error ? err.message : 'Failed to save configuration.');
          } finally {
            setModalBusy(false);
          }
        }}
      />
    </div>
  );
};
