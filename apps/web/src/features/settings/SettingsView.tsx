import React, { useEffect, useMemo, useState } from 'react';
import {
  AccountType,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  TranslationKey,
  getLocaleConfig,
  normalizeLocaleCode,
  sumMoney,
} from '@sure/shared';
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
  Toggle,
  ThemePreference,
  useLocale,
  useTheme,
} from '@sure/ui';
import { useAuth } from '../auth/AuthContext.js';
import { apiRequest } from '../../lib/api-client.js';
import {
  createBrowserPasskey,
  isWebAuthnSupported,
  ServerRegistrationOptions,
} from '../../lib/webauthn.js';
import { useLedger, WebAccount } from '../../lib/ledger-context.js';
import {
  TransactionsSettingsSections,
  TransactionsSectionId,
} from './TransactionsSettingsSections.js';
import {
  AdvancedSettingsSections,
  AdvancedSectionId,
} from './AdvancedSettingsSections.js';
import {
  MoreSettingsSections,
  MoreSectionId,
} from './MoreSettingsSections.js';
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Box,
  ChevronLeft,
  Download,
  ExternalLink,
  Fingerprint,
  GitBranch,
  Key,
  Landmark,
  Layers,
  Link2,
  Lock,
  Megaphone,
  MoreHorizontal,
  Palette,
  Plug,
  Plus,
  RefreshCw,
  Repeat,
  Settings as SettingsIcon,
  Shapes,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tag,
  Trash2,
  Upload,
  UserCircle,
  UserPlus,
  Users,
  LogOut,
  AlertTriangle,
} from 'lucide-react';

type SettingsSectionId =
  | 'accounts'
  | 'sync'
  | 'preferences'
  | 'appearance'
  | 'profile'
  | 'security'
  | TransactionsSectionId
  | AdvancedSectionId
  | MoreSectionId;

interface SettingsNavItem {
  id: SettingsSectionId;
  labelKey: TranslationKey;
  pageTitleKey?: TranslationKey;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SettingsNavGroup {
  headingKey: TranslationKey;
  heading: string;
  items: SettingsNavItem[];
}

const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    headingKey: 'settings.group.general',
    heading: 'General',
    items: [
      {
        id: 'accounts',
        labelKey: 'settings.item.accounts',
        label: 'Accounts',
        icon: Layers,
      },
      {
        id: 'sync',
        labelKey: 'settings.item.sync',
        label: 'Bank sync',
        subtitle:
          'Connect external accounts so transactions, balances and holdings flow into Sure automatically.',
        icon: Landmark,
      },
      {
        id: 'preferences',
        labelKey: 'settings.item.preferences',
        label: 'Preferences',
        icon: SettingsIcon,
      },
      {
        id: 'appearance',
        labelKey: 'settings.item.appearance',
        label: 'Appearance',
        icon: Palette,
      },
      {
        id: 'profile',
        labelKey: 'settings.item.profile',
        label: 'Profile Info',
        icon: UserCircle,
      },
      {
        id: 'security',
        labelKey: 'settings.item.security',
        label: 'Security',
        icon: ShieldCheck,
      },
    ],
  },
  {
    headingKey: 'settings.group.transactions',
    heading: 'Transactions',
    items: [
      {
        id: 'categories',
        labelKey: 'settings.item.categories',
        label: 'Categories',
        icon: Shapes,
      },
      {
        id: 'tags',
        labelKey: 'settings.item.tags',
        label: 'Tags',
        icon: Tag,
      },
      {
        id: 'rules',
        labelKey: 'settings.item.rules',
        label: 'Rules',
        icon: GitBranch,
      },
      {
        id: 'merchants',
        labelKey: 'settings.item.merchants',
        label: 'Merchants',
        icon: Store,
      },
      {
        id: 'recurring',
        labelKey: 'settings.item.recurring',
        label: 'Recurring',
        icon: Repeat,
      },
      {
        id: 'auto_matches',
        labelKey: 'settings.item.auto_matches',
        label: 'Auto Matches',
        icon: Link2,
      },
      {
        id: 'statement_vault',
        labelKey: 'settings.item.statement_vault',
        label: 'Statement Vault',
        icon: Archive,
      },
    ],
  },
  {
    headingKey: 'settings.group.advanced',
    heading: 'Advanced',
    items: [
      {
        id: 'ai_prompts',
        labelKey: 'settings.item.ai_prompts',
        label: 'AI Prompts',
        icon: Bot,
      },
      {
        id: 'classifier',
        labelKey: 'settings.item.classifier',
        label: 'Classifier',
        icon: SlidersHorizontal,
      },
      {
        id: 'llm_usage',
        labelKey: 'settings.item.llm_usage',
        pageTitleKey: 'llmUsage.pageTitle',
        label: 'LLM Usage',
        icon: Activity,
      },
      {
        id: 'api_keys',
        labelKey: 'settings.item.api_keys',
        label: 'API Keys',
        icon: Key,
      },
      {
        id: 'mcp',
        labelKey: 'settings.item.mcp',
        label: 'MCP',
        icon: Plug,
      },
      {
        id: 'imports',
        labelKey: 'settings.item.imports',
        label: 'Imports',
        icon: Download,
      },
      {
        id: 'exports',
        labelKey: 'settings.item.exports',
        label: 'Exports',
        icon: Upload,
      },
    ],
  },
  {
    headingKey: 'settings.group.more',
    heading: 'More',
    items: [
      {
        id: 'guides',
        labelKey: 'settings.item.guides',
        label: 'Guides',
        icon: BookOpen,
      },
      {
        id: 'whats_new',
        labelKey: 'settings.item.whats_new',
        label: "What's new",
        icon: Box,
      },
      {
        id: 'feedback',
        labelKey: 'settings.item.feedback',
        label: 'Feedback',
        icon: Megaphone,
      },
    ],
  },
];

const FLAT_SECTIONS = SETTINGS_NAV_GROUPS.flatMap((g) => g.items);

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

interface LocalWorkspacePrefs {
  language: string;
  timezone: string;
  dateFormat: string;
  country: string;
  budgetStartDay: string;
  additionalCurrencies: string[];
  defaultSharing: string;
  enablePreviewFeatures: boolean;
  defaultAccountOrder: string;
  twoColumnDashboard: boolean;
  startExpanded: boolean;
  keepModalsOpen: boolean;
  groupSplitTransactions: boolean;
  autoGenerateNames: boolean;
  enableAutoMatch: boolean;
}

const DEFAULT_PREFS: LocalWorkspacePrefs = {
  language: 'en',
  timezone: '(-06:00) Central Time',
  dateFormat: 'YYYY-MM-DD',
  country: 'US',
  budgetStartDay: '1st',
  additionalCurrencies: ['EUR', 'GBP'],
  defaultSharing: 'Share with all members',
  enablePreviewFeatures: true,
  defaultAccountOrder: 'Name (A-Z)',
  twoColumnDashboard: true,
  startExpanded: true,
  keepModalsOpen: false,
  groupSplitTransactions: true,
  autoGenerateNames: false,
  enableAutoMatch: true,
};

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

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export const SettingsView: React.FC<{
  onBack?: () => void;
  onSignOut?: () => void;
  onOpenAccount?: (accountId: string) => void;
  onNavigateToImports?: () => void;
}> = ({ onBack, onSignOut, onOpenAccount, onNavigateToImports }) => {
  const { session, refreshSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const {
    family,
    accounts,
    syncAdapters,
    syncConnections,
    updateFamilySettings,
    inviteFamilyMember,
    createAccount,
    deleteAccount,
    connectProvider,
    runSyncAll,
    setupMfa,
    enableMfa,
    changePassword,
    downloadFamilyBackup,
  } = useLedger();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('accounts');

  // Persisted UI preferences per family
  const [prefs, setPrefs] = useState<LocalWorkspacePrefs>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`sure:prefs:${family.id}`);
        if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
      } catch {
        // Ignore storage read errors
      }
    }
    return DEFAULT_PREFS;
  });

  const updatePref = <K extends keyof LocalWorkspacePrefs>(key: K, value: LocalWorkspacePrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(`sure:prefs:${family.id}`, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  };

  // Accounts tab state
  const [accountMenuId, setAccountMenuId] = useState<string | null>(null);
  const [createAccOpen, setCreateAccOpen] = useState<boolean>(false);
  const [newAccType, setNewAccType] = useState<AccountType>('DEPOSITORY');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccBalance, setNewAccBalance] = useState<string>('0.00');
  const [newAccColor, setNewAccColor] = useState<string>('#078C52');
  const [newAccIcon, setNewAccIcon] = useState<string>('Wallet');
  const [syncBusy, setSyncBusy] = useState<boolean>(false);

  // Bank sync state
  const [providerSearch, setProviderSearch] = useState<string>('');
  const [providerCategory, setProviderCategory] = useState<'ALL' | 'BANKS' | 'CRYPTO' | 'INVESTMENTS'>('ALL');
  const [connectingAdapter, setConnectingAdapter] = useState<{ key: string; label: string } | null>(null);
  const [institutionDraft, setInstitutionDraft] = useState<string>('');

  // Preferences state
  const [currencyModalOpen, setCurrencyModalOpen] = useState<boolean>(false);

  // Profile Info & Household state
  const fullName = session?.user.name || 'Sure User';
  const [firstName, lastName] = useMemo(() => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return [parts[0] ?? '', ''];
    return [parts[0]!, parts.slice(1).join(' ')];
  }, [fullName]);
  const [familyNameDraft, setFamilyNameDraft] = useState(family.name);
  const [showAddMember, setShowAddMember] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  // Security state
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // Passkey & OAuth security state
  const [passkeyNameDraft, setPasskeyNameDraft] = useState('MacBook / Windows Hello');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [oauthProviders, setOauthProviders] = useState<{
    google: boolean;
    github: boolean;
    googleRedirectUri: string;
    githubRedirectUri: string;
  } | null>(null);

  useEffect(() => {
    if (activeSection !== 'security') return;
    void apiRequest<{
      google: boolean;
      github: boolean;
      googleRedirectUri: string;
      githubRedirectUri: string;
    }>('/api/v1/auth/providers')
      .then(setOauthProviders)
      .catch(() => null);
  }, [activeSection]);

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyStatus(null);
    if (!isWebAuthnSupported()) {
      setPasskeyStatus({ kind: 'error', text: 'This browser does not support WebAuthn Passkeys.' });
      return;
    }
    setPasskeyBusy(true);
    try {
      const opts = await apiRequest<{
        challengeToken: string;
        options: ServerRegistrationOptions;
      }>('/api/v1/auth/passkeys/register/options', { method: 'POST' });

      const attestation = await createBrowserPasskey(opts.options);
      await apiRequest('/api/v1/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          ...attestation,
          name: passkeyNameDraft.trim() || 'Passkey',
          challengeToken: opts.challengeToken,
        }),
      });
      await refreshSession();
      setPasskeyStatus({
        kind: 'success',
        text: 'Passkey registered! You can now use it for passwordless sign-in or as MFA.',
      });
    } catch (err) {
      setPasskeyStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to register passkey',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setPasskeyStatus(null);
    setPasskeyBusy(true);
    try {
      await apiRequest(`/api/v1/auth/passkeys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await refreshSession();
      setPasskeyStatus({ kind: 'success', text: 'Passkey removed.' });
    } catch (err) {
      setPasskeyStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove passkey',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleEnablePasskeyMfa = async () => {
    setPasskeyStatus(null);
    setPasskeyBusy(true);
    try {
      await apiRequest('/api/v1/auth/mfa/enable-passkey', { method: 'POST' });
      await refreshSession();
      setPasskeyStatus({
        kind: 'success',
        text: 'MFA enabled using your registered Passkey.',
      });
    } catch (err) {
      setPasskeyStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not enable Passkey MFA',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  // Backup state
  const [backupBusy, setBackupBusy] = useState(false);

  // Trigger counter for header "+ New ..." buttons delegated into TransactionsSettingsSections
  const [txActionTrigger, setTxActionTrigger] = useState<{
    section: TransactionsSectionId;
    tick: number;
  } | null>(null);

  // Trigger counter for header "+ New API Key" button delegated into AdvancedSettingsSections
  const [advActionTrigger, setAdvActionTrigger] = useState<{
    section: AdvancedSectionId;
    tick: number;
  } | null>(null);

  useEffect(() => {
    setFamilyNameDraft(family.name);
  }, [family.name]);

  useEffect(() => {
    if (!onBack) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const activeIndex = FLAT_SECTIONS.findIndex((s) => s.id === activeSection);
  const activeNavItem = FLAT_SECTIONS[activeIndex] ?? FLAT_SECTIONS[0]!;
  const prevNavItem = activeIndex > 0 ? FLAT_SECTIONS[activeIndex - 1]! : null;
  const nextNavItem = activeIndex < FLAT_SECTIONS.length - 1 ? FLAT_SECTIONS[activeIndex + 1]! : null;

  // Group accounts by accountType for the Accounts Overview card
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

  // Filter backend syncAdapters by category & search query
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

  const handleToggleMfa = async (next: boolean) => {
    if (!next) {
      await updateFamilySettings({ mfaEnabled: false });
      setMfaSetupData(null);
      return;
    }
    const setup = await setupMfa();
    setMfaSetupData(setup);
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    await enableMfa(totpCode.trim());
    setMfaSetupData(null);
    setTotpCode('');
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    await inviteFamilyMember({
      email: inviteEmail.trim(),
      name: inviteName.trim(),
      role: inviteRole,
    });
    setInviteEmail('');
    setInviteName('');
    setShowAddMember(false);
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
    setCreateAccOpen(false);
  };

  const handleSyncAll = async () => {
    setSyncBusy(true);
    try {
      await runSyncAll();
    } finally {
      setSyncBusy(false);
    }
  };

  const toggleAdditionalCurrency = (code: string) => {
    const exists = prefs.additionalCurrencies.includes(code);
    const next = exists
      ? prefs.additionalCurrencies.filter((c) => c !== code)
      : [...prefs.additionalCurrencies, code];
    updatePref('additionalCurrencies', next);
  };

  const currentCurrencyObj =
    SUPPORTED_CURRENCIES.find((c) => c.code === family.baseCurrency) ?? {
      code: family.baseCurrency,
      name: family.baseCurrency,
      nativeName: family.baseCurrency,
    };

  const applyIndonesianDefaults = async () => {
    setLocale('id');
    updatePref('language', 'id');
    updatePref('timezone', '(+07:00) Jakarta (WIB)');
    updatePref('dateFormat', 'DD/MM/YYYY');
    updatePref('country', 'ID');
    await updateFamilySettings({
      locale: 'id-ID',
      dateFormat: 'DD/MM/YYYY',
      baseCurrency: 'IDR',
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 min-h-[75vh]">
      {/* Left Settings Sidebar (Matches Sure Settings Nav) */}
      <aside className="w-full md:w-60 shrink-0 flex flex-col justify-between md:border-r border-[var(--border-primary)] md:pr-5 space-y-6">
        <div className="space-y-6">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono-tabular uppercase rounded border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
                esc
              </kbd>
            </button>
          )}

          <nav className="space-y-6">
            {SETTINGS_NAV_GROUPS.map((group) => (
              <div key={group.heading} className="space-y-1.5">
                <div className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {t(group.headingKey)}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${active
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-primary)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                          }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{t(item.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {onSignOut && (
          <div className="pt-4 border-t border-[var(--border-primary)]">
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium rounded-lg text-[var(--status-negative)] hover:bg-[var(--status-negative)]/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Right Focused Content Area */}
      <div className="flex-1 min-w-0 max-w-3xl space-y-6">
        {/* Page Heading */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--border-primary)]">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {t(activeNavItem.pageTitleKey ?? activeNavItem.labelKey)}
            </h1>
            {activeNavItem.subtitle && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">{activeNavItem.subtitle}</p>
            )}
          </div>

          {activeSection === 'accounts' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSyncAll()}
                disabled={syncBusy}
                aria-label="Sync connected institutions"
                className="p-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncBusy ? 'animate-spin' : ''}`} />
              </button>
              <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAccOpen(true)}>
                New account
              </Button>
            </div>
          )}

          {(activeSection === 'categories' ||
            activeSection === 'tags' ||
            activeSection === 'merchants') && (
              <Button
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() =>
                  setTxActionTrigger((prev) => ({
                    section: activeSection,
                    tick: (prev?.tick ?? 0) + 1,
                  }))
                }
              >
                {activeSection === 'categories'
                  ? 'New category'
                  : activeSection === 'tags'
                    ? 'New tag'
                    : 'New merchant'}
              </Button>
            )}

          {activeSection === 'api_keys' && (
            <Button
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() =>
                setAdvActionTrigger((prev) => ({
                  section: 'api_keys',
                  tick: (prev?.tick ?? 0) + 1,
                }))
              }
            >
              New API Key
            </Button>
          )}
        </div>

        {/* 1. ACCOUNTS (Matches Sure Screenshot 1) */}
        {activeSection === 'accounts' && (
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
                              className={`flex items-center gap-3 min-w-0 flex-1 ${onOpenAccount ? 'cursor-pointer' : ''
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
          </div>
        )}

        {/* 2. BANK SYNC (Matches Sure Screenshots 2 & 3) */}
        {activeSection === 'sync' && (
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
                            onClick={() => void handleSyncAll()}
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
          </div>
        )}

        {/* 3. PREFERENCES (Matches Sure Screenshots 4 & 5) */}
        {activeSection === 'preferences' && (
          <div className="space-y-5">
            <Card title={t('prefs.general.title')} subtitle={t('prefs.general.subtitle')}>
              <div className="space-y-3.5">
                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                    {t('prefs.language')}
                  </label>
                  <select
                    value={normalizeLocaleCode(locale || prefs.language)}
                    onChange={(e) => {
                      const nextLang = e.target.value;
                      updatePref('language', nextLang);
                      setLocale(nextLang);
                      void updateFamilySettings({ locale: getLocaleConfig(nextLang).bcp47 });
                    }}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                {locale === 'id' &&
                  (family.baseCurrency !== 'IDR' ||
                    prefs.country !== 'ID' ||
                    prefs.dateFormat !== 'DD/MM/YYYY') && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs">
                      <span className="text-[var(--text-primary)]">
                        Terapkan standar Indonesia penuh (<strong>IDR</strong>,{' '}
                        <strong>Jakarta WIB</strong>, <strong>DD/MM/YYYY</strong>,{' '}
                        <strong>Indonesia</strong>)?
                      </span>
                      <Button size="sm" onClick={() => void applyIndonesianDefaults()}>
                        Terapkan Default ID & IDR
                      </Button>
                    </div>
                  )}

                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                    {t('prefs.timezone')}
                  </label>
                  <select
                    value={prefs.timezone}
                    onChange={(e) => updatePref('timezone', e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="(-08:00) Pacific Time">(-08:00) Pacific Time</option>
                    <option value="(-06:00) Central Time">(-06:00) Central Time</option>
                    <option value="(-05:00) Eastern Time">(-05:00) Eastern Time</option>
                    <option value="(+00:00) UTC">(+00:00) UTC</option>
                    <option value="(+01:00) Berlin">(+01:00) Berlin</option>
                    <option value="(+07:00) Jakarta (WIB)">(+07:00) Jakarta (WIB)</option>
                    <option value="(+07:00) Bangkok / Jakarta">(+07:00) Bangkok / Jakarta</option>
                    <option value="(+08:00) Makassar (WITA)">(+08:00) Makassar (WITA)</option>
                    <option value="(+08:00) Singapore">(+08:00) Singapore</option>
                    <option value="(+09:00) Jayapura (WIT)">(+09:00) Jayapura (WIT)</option>
                  </select>
                </div>

                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                    {t('prefs.dateFormat')}
                  </label>
                  <select
                    value={prefs.dateFormat}
                    onChange={(e) => {
                      const nextFmt = e.target.value;
                      updatePref('dateFormat', nextFmt);
                      void updateFamilySettings({ dateFormat: nextFmt });
                    }}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                  </select>
                </div>

                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                    {t('prefs.country')}
                  </label>
                  <select
                    value={prefs.country}
                    onChange={(e) => updatePref('country', e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="ID">ID — Indonesia</option>
                    <option value="US">US — United States</option>
                    <option value="GB">GB — United Kingdom</option>
                    <option value="CA">CA — Canada</option>
                    <option value="DE">DE — Germany</option>
                    <option value="SG">SG — Singapore</option>
                    <option value="CN">CN — China</option>
                  </select>
                </div>

                <p className="text-xs italic text-[var(--text-muted)]">
                  {t('prefs.translationNote')}
                </p>
              </div>
            </Card>

            <Card title={t('prefs.budget.title')} subtitle={t('prefs.budget.subtitle')}>
              <div className="space-y-3.5">
                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                    {t('prefs.budget.startDay')}
                  </label>
                  <select
                    value={prefs.budgetStartDay}
                    onChange={(e) => updatePref('budgetStartDay', e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="1st">1st</option>
                    <option value="5th">5th</option>
                    <option value="10th">10th</option>
                    <option value="15th">15th</option>
                    <option value="22nd">22nd</option>
                    <option value="25th">25th</option>
                  </select>
                </div>

                {prefs.budgetStartDay !== '1st' && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-[var(--text-primary)]">
                    <AlertTriangle className="w-4 h-4 text-[var(--status-warning)] shrink-0" />
                    <span>
                      Your budgets and MTD calculations will use this custom start day instead of the 1st of each month.
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <Card title={t('prefs.currencies.title')} subtitle={t('prefs.currencies.subtitle')}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] p-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      {t('prefs.currencies.base')}
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {currentCurrencyObj.code}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {locale === 'id' ? currentCurrencyObj.nativeName : currentCurrencyObj.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t('prefs.currencies.additional')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {prefs.additionalCurrencies.length === 0 ? (
                        <span className="text-xs text-[var(--text-muted)]">None selected</span>
                      ) : (
                        prefs.additionalCurrencies.map((code) => (
                          <span
                            key={code}
                            className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-primary)] text-xs font-mono-tabular font-medium text-[var(--text-primary)]"
                          >
                            {code}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setCurrencyModalOpen(true)}>
                    {t('prefs.currencies.manage')}
                  </Button>
                </div>
              </div>
            </Card>

            <Card title={t('prefs.sharing.title')} subtitle={t('prefs.sharing.subtitle')}>
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                    Default sharing for new accounts
                  </label>
                  <select
                    value={prefs.defaultSharing}
                    onChange={(e) => updatePref('defaultSharing', e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="Share with all members">Share with all members</option>
                    <option value="Private to owner">Private to owner</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-[var(--border-primary)]">
                  <Toggle
                    checked={family.aiEnabled}
                    onChange={(aiEnabled) => void updateFamilySettings({ aiEnabled })}
                    label="Explicit AI Financial Assistant Consent (family.aiEnabled)"
                    description="Financial records are never sent to external LLM providers unless explicitly opted in."
                  />
                </div>
              </div>
            </Card>

            <Card padding="sm">
              <div className="px-1">
                <Toggle
                  checked={prefs.enablePreviewFeatures}
                  onChange={(v) => updatePref('enablePreviewFeatures', v)}
                  label="Enable preview features"
                  description="Opt in to in-progress features tagged preview or canary."
                />
              </div>
            </Card>
          </div>
        )}

        {/* 4. APPEARANCE (Matches Sure Screenshots 6 & 7) */}
        {activeSection === 'appearance' && (
          <div className="space-y-5">
            <Card title="Theme" subtitle="Choose a preferred theme for the app">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(
                  [
                    {
                      id: 'light',
                      label: 'Light',
                      preview: '/images/light-mode-preview.png',
                    },
                    {
                      id: 'dark',
                      label: 'Dark',
                      preview: '/images/dark-mode-preview.png',
                    },
                    {
                      id: 'system',
                      label: 'System',
                      preview: '/images/system-mode-preview.png',
                    },
                  ] satisfies Array<{ id: ThemePreference; label: string; preview: string }>
                ).map((opt) => {
                  const active = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      className={`text-center p-2.5 rounded-xl border transition-colors cursor-pointer ${active
                        ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] bg-[var(--bg-surface-subtle)]'
                        : 'border-[var(--border-primary)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                    >
                      <img
                        src={opt.preview}
                        alt={opt.label}
                        className="w-full h-24 object-cover rounded-lg border border-[var(--border-primary)] mb-2"
                      />
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="Dashboard" subtitle="Customize how the dashboard is displayed">
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                    Default Account Order
                  </label>
                  <select
                    value={prefs.defaultAccountOrder}
                    onChange={(e) => updatePref('defaultAccountOrder', e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="Name (A-Z)">Name (A-Z)</option>
                    <option value="Balance (High to Low)">Balance (High to Low)</option>
                    <option value="Balance (Low to High)">Balance (Low to High)</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>

                <Toggle
                  checked={prefs.twoColumnDashboard}
                  onChange={(v) => updatePref('twoColumnDashboard', v)}
                  label="Two-column layout"
                  description="Display dashboard widgets in two columns on large screens, with responsive stacking on narrower viewports."
                />

                <div className="pt-3 border-t border-[var(--border-primary)]">
                  <Toggle
                    checked={prefs.startExpanded}
                    onChange={(v) => updatePref('startExpanded', v)}
                    label="Start expanded by default"
                    description="Account sections start expanded on the dashboard and in the account sidebar. You can still collapse them manually."
                  />
                </div>
              </div>
            </Card>

            <Card title="Modals" subtitle="Customize modal behavior">
              <Toggle
                checked={prefs.keepModalsOpen}
                onChange={(v) => updatePref('keepModalsOpen', v)}
                label="Keep modals open on outside click"
                description="Prevent modals from closing when clicking outside. Useful to avoid accidentally losing unsaved changes."
              />
            </Card>

            <Card title="Transactions" subtitle="Customize how transactions are displayed">
              <div className="space-y-4">
                <Toggle
                  checked={prefs.groupSplitTransactions}
                  onChange={(v) => updatePref('groupSplitTransactions', v)}
                  label="Group split transactions"
                  description="Show split transactions grouped under their parent in the transaction list."
                />
                <div className="pt-3 border-t border-[var(--border-primary)]">
                  <Toggle
                    checked={prefs.autoGenerateNames}
                    onChange={(v) => updatePref('autoGenerateNames', v)}
                    label="Auto-generate transaction names"
                    description='When a manually entered transaction name is left blank, fill it in from category and merchant (e.g. "Entertainment - Netflix").'
                  />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 5. PROFILE INFO (Matches Sure Screenshots 8 & 9) */}
        {activeSection === 'profile' && (
          <div className="space-y-5">
            <Card title="Personal" subtitle="Customize how you appear on Sure">
              <div className="space-y-4">
                <div className="flex flex-col items-center py-2">
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-lg font-semibold text-[var(--text-secondary)]">
                    {getInitials(fullName)}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-2">
                    Signed in as <strong className="text-[var(--text-primary)]">{session?.role ?? 'MEMBER'}</strong>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface-subtle)]">
                  <div className="text-[11px] font-medium text-[var(--text-secondary)]">Email</div>
                  <div className="text-sm text-[var(--text-primary)] mt-0.5">
                    {session?.user.email ?? '—'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface-subtle)]">
                    <div className="text-[11px] font-medium text-[var(--text-secondary)]">First Name</div>
                    <div className="text-sm text-[var(--text-primary)] mt-0.5">{firstName || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface-subtle)]">
                    <div className="text-[11px] font-medium text-[var(--text-secondary)]">Last Name</div>
                    <div className="text-sm text-[var(--text-primary)] mt-0.5">{lastName || '—'}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Household" subtitle="Invitees can login to your family account and access shared resources.">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-[var(--border-strong)] px-3.5 py-1.5 bg-[var(--bg-surface)]">
                    <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                      Household name
                    </label>
                    <input
                      type="text"
                      value={familyNameDraft}
                      onChange={(e) => setFamilyNameDraft(e.target.value)}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                  <Button
                    disabled={!familyNameDraft.trim() || familyNameDraft === family.name}
                    onClick={() => void updateFamilySettings({ name: familyNameDraft.trim() })}
                  >
                    Save
                  </Button>
                </div>

                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] overflow-hidden">
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-primary)]">
                    {family.name.toUpperCase()} <span className="mx-1">•</span> {family.members.length}
                  </div>
                  <div className="divide-y divide-[var(--border-primary)] bg-[var(--bg-surface)]">
                    {family.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
                            {getInitials(m.name)}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--text-primary)]">
                                {m.name}
                              </span>
                              <Pill
                                label={m.role}
                                color={m.role === 'OWNER' ? '#078C52' : m.role === 'ADMIN' ? '#3b82f6' : '#64748b'}
                                size="xs"
                              />
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">{m.email}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showAddMember ? (
                    <form
                      onSubmit={handleInviteMember}
                      className="p-3 bg-[var(--bg-surface-subtle)] border-t border-[var(--border-primary)] flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="text"
                        required
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Member name"
                        className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                      />
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@family.com"
                        className="flex-1 min-w-[150px] px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                      >
                        <option value="MEMBER">MEMBER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <Button type="submit" size="sm" icon={<UserPlus className="w-3.5 h-3.5" />}>
                        Add
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddMember(false)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddMember(true)}
                      className="w-full py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border-t border-[var(--border-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add member</span>
                    </button>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Data & Session" subtitle="Export household snapshot or end active session">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      Download full family backup
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Exports accounts, holdings, entries, categories, tags, budgets, goals, and rules as JSON.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download className="w-3.5 h-3.5" />}
                    disabled={backupBusy}
                    onClick={async () => {
                      setBackupBusy(true);
                      try {
                        await downloadFamilyBackup();
                      } finally {
                        setBackupBusy(false);
                      }
                    }}
                  >
                    {backupBusy ? 'Exporting...' : 'Export JSON'}
                  </Button>
                </div>

                {onSignOut && (
                  <div className="pt-3 border-t border-[var(--border-primary)] flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        Sign out of session
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        Ends your authenticated session on this browser.
                      </div>
                    </div>
                    <Button size="sm" variant="destructive" onClick={onSignOut}>
                      Sign out
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* 6. SECURITY (Matches Sure Screenshot 10) */}
        {activeSection === 'security' && (
          <div className="space-y-5">
            <Card
              title="Two-Factor Authentication"
              subtitle="Add an extra layer of security to your account by requiring a code from your authenticator app when signing in"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                      <Shield className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        Two-factor authentication is{' '}
                        <span
                          className={
                            family.mfaEnabled
                              ? 'text-[var(--status-positive)] font-semibold'
                              : 'text-[var(--status-negative)] font-semibold'
                          }
                        >
                          {family.mfaEnabled ? 'enabled' : 'disabled'}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {family.mfaEnabled
                          ? 'Your account requires an RFC 6238 authenticator code on sign-in.'
                          : 'Enable 2FA to add an extra layer of security to your account.'}
                      </div>
                    </div>
                  </div>

                  {family.mfaEnabled ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleToggleMfa(false)}
                    >
                      Disable 2FA
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void handleToggleMfa(true)}>
                      Enable 2FA
                    </Button>
                  )}
                </div>

                {mfaSetupData && (
                  <Alert variant="info" title="Verify Authenticator Setup">
                    <div className="space-y-2 mt-1">
                      <p className="text-xs">
                        Add this secret key to your authenticator app:{' '}
                        <code className="font-mono-tabular font-bold">{mfaSetupData.secret}</code>
                      </p>
                      <form onSubmit={handleConfirmMfa} className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          placeholder="6-digit code"
                          className="w-36 px-2.5 py-1.5 text-xs font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                        />
                        <Button type="submit" size="sm">
                          Verify & Enable
                        </Button>
                      </form>
                    </div>
                  </Alert>
                )}
              </div>
            </Card>

            <Card title="Password" subtitle="Update your account sign-in password">
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPwStatus(null);
                  if (!currentPassword || newPassword.length < 8) {
                    setPwStatus({
                      kind: 'error',
                      text: 'New password must be at least 8 characters.',
                    });
                    return;
                  }
                  setPwBusy(true);
                  try {
                    await changePassword(currentPassword, newPassword);
                    setCurrentPassword('');
                    setNewPassword('');
                    setPwStatus({ kind: 'success', text: 'Password updated successfully.' });
                  } catch (err) {
                    setPwStatus({
                      kind: 'error',
                      text: err instanceof Error ? err.message : 'Failed to update password',
                    });
                  } finally {
                    setPwBusy(false);
                  }
                }}
              >
                {pwStatus && (
                  <Alert
                    variant={pwStatus.kind === 'success' ? 'success' : 'error'}
                    title={pwStatus.kind === 'success' ? 'Password Updated' : 'Update Failed'}
                  >
                    {pwStatus.text}
                  </Alert>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                  <input
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  icon={<Lock className="w-3.5 h-3.5" />}
                  disabled={pwBusy}
                >
                  {pwBusy ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </Card>

            <Card
              title="Passkeys (WebAuthn)"
              subtitle="Use Touch ID, Face ID, Windows Hello, or a hardware security key for passwordless sign-in and two-factor authentication"
            >
              <div className="space-y-3.5">
                {passkeyStatus && (
                  <Alert
                    variant={passkeyStatus.kind === 'success' ? 'success' : 'error'}
                    title={passkeyStatus.kind === 'success' ? 'Passkey Updated' : 'Passkey Error'}
                  >
                    {passkeyStatus.text}
                  </Alert>
                )}

                {(session?.user.passkeys?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    {session!.user.passkeys!.map((pk) => (
                      <div
                        key={pk.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                            <Fingerprint className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {pk.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                              Registered {pk.createdAt.slice(0, 10)} • Sign-ins: {pk.counter}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={passkeyBusy}
                          onClick={() => void handleDeletePasskey(pk.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[var(--status-negative)]" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleRegisterPasskey} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={passkeyNameDraft}
                    onChange={(e) => setPasskeyNameDraft(e.target.value)}
                    placeholder="Device name (e.g. Windows Hello, YubiKey)"
                    className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={passkeyBusy}
                    icon={<Fingerprint className="w-3.5 h-3.5" />}
                  >
                    {passkeyBusy ? 'Waiting for prompt...' : 'Add Passkey'}
                  </Button>
                  {(session?.user.passkeys?.length ?? 0) > 0 && !session?.user.mfaEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={passkeyBusy}
                      onClick={() => void handleEnablePasskeyMfa()}
                    >
                      Enable Passkey MFA
                    </Button>
                  )}
                </form>
              </div>
            </Card>

            <Card
              title="Connected Accounts (OAuth 2.0)"
              subtitle="Single sign-on status and PKCE callback URIs for external identity providers"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">Google OAuth</div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular break-all">
                      Callback: {oauthProviders?.googleRedirectUri || '/api/v1/auth/oauth/google/callback'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill
                      size="xs"
                      color={oauthProviders?.google ? '#078C52' : '#64748b'}
                      label={oauthProviders?.google ? 'Configured' : 'Set GOOGLE_CLIENT_ID in .env'}
                    />
                    {oauthProviders?.google && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          window.location.href = '/api/v1/auth/oauth/google/start';
                        }}
                      >
                        Link / Test
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">GitHub OAuth</div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular break-all">
                      Callback: {oauthProviders?.githubRedirectUri || '/api/v1/auth/oauth/github/callback'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill
                      size="xs"
                      color={oauthProviders?.github ? '#078C52' : '#64748b'}
                      label={oauthProviders?.github ? 'Configured' : 'Set GITHUB_CLIENT_ID in .env'}
                    />
                    {oauthProviders?.github && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          window.location.href = '/api/v1/auth/oauth/github/start';
                        }}
                      >
                        Link / Test
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 7. TRANSACTIONS SETTINGS (Categories, Tags, Rules, Merchants, Recurring, Auto Matches, Statement Vault) */}
        {(activeSection === 'categories' ||
          activeSection === 'tags' ||
          activeSection === 'rules' ||
          activeSection === 'merchants' ||
          activeSection === 'recurring' ||
          activeSection === 'auto_matches' ||
          activeSection === 'statement_vault') && (
            <TransactionsSettingsSections
              activeSection={activeSection}
              enableAutoMatch={prefs.enableAutoMatch}
              onToggleAutoMatch={(v) => updatePref('enableAutoMatch', v)}
              actionTriggerCounter={txActionTrigger}
            />
          )}

        {/* 8. ADVANCED SETTINGS (AI Prompts, Classifier, LLM Usage, API Keys, MCP, Imports, Exports) */}
        {(activeSection === 'ai_prompts' ||
          activeSection === 'classifier' ||
          activeSection === 'llm_usage' ||
          activeSection === 'api_keys' ||
          activeSection === 'mcp' ||
          activeSection === 'imports' ||
          activeSection === 'exports') && (
            <AdvancedSettingsSections
              activeSection={activeSection}
              actionTriggerCounter={advActionTrigger}
              onNavigateToImports={onNavigateToImports}
            />
          )}

        {/* 9. MORE SETTINGS (Guides, What's new, Feedback) */}
        {(activeSection === 'guides' ||
          activeSection === 'whats_new' ||
          activeSection === 'feedback') && (
            <MoreSettingsSections activeSection={activeSection} />
          )}

        {/* Bottom Prev / Next Section Navigation (Matches Sure Screenshots) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {prevNavItem ? (
            <button
              type="button"
              onClick={() => setActiveSection(prevNavItem.id)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer ${!nextNavItem ? 'sm:col-span-2' : ''
                }`}
            >
              <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]" />
              <div className="text-right">
                <div className="text-[11px] text-[var(--text-secondary)]">{t('nav.back')}</div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t(prevNavItem.labelKey)}
                </div>
              </div>
            </button>
          ) : (
            <div />
          )}

          {nextNavItem && (
            <button
              type="button"
              onClick={() => setActiveSection(nextNavItem.id)}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer"
            >
              <div>
                <div className="text-[11px] text-[var(--text-secondary)]">{t('nav.next')}</div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t(nextNavItem.labelKey)}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>
      </div>

      {/* Create Account Modal from Settings -> Accounts */}
      <Dialog
        open={createAccOpen}
        onClose={() => setCreateAccOpen(false)}
        title="New Account"
        description="Supports all 9 Sure account classifications with automatic opening valuation."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateAccOpen(false)}>
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
                  {ACCOUNT_GROUP_LABELS[t] || t} ({t})
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

      {/* Manage Family Currencies Modal */}
      <Dialog
        open={currencyModalOpen}
        onClose={() => setCurrencyModalOpen(false)}
        title="Manage Family Currencies"
        description="Set the household base currency and additional currencies available in money fields."
        footer={
          <Button onClick={() => setCurrencyModalOpen(false)}>Done</Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Base Currency
            </label>
            <select
              value={family.baseCurrency}
              onChange={(e) => void updateFamilySettings({ baseCurrency: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {locale === 'id' ? c.nativeName : c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
              Additional Display Currencies
            </div>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_CURRENCIES.filter((c) => c.code !== family.baseCurrency).map((c) => {
                const selected = prefs.additionalCurrencies.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleAdditionalCurrency(c.code)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono-tabular border cursor-pointer ${selected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] border-transparent'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-primary)]'
                      }`}
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
