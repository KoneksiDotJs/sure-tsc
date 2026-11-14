import React, { useState, useEffect, useMemo } from 'react';
import { addMoney } from '@sure/shared';
import {
  PrivacyModeProvider,
  usePrivacyMode,
  ThemeProvider,
  useTheme,
  Button,
  SlideOverDrawer,
  Dialog,
  Alert,
  Pill,
  SegmentedControl,
  MoneyAmount,
  CategoryIcon,
  Sparkline,
} from '@sure/ui';
import { LedgerProvider, useLedger, WebAccount } from '../lib/ledger-context.js';
import { AuthProvider, useAuth } from '../features/auth/AuthContext.js';
import { AuthPage } from '../features/auth/AuthPage.js';
import { apiRequest } from '../lib/api-client.js';
import { DashboardView } from '../features/dashboard/DashboardView.js';
import { AccountsView } from '../features/accounts/AccountsView.js';
import { TransactionsView } from '../features/transactions/TransactionsView.js';
import { ImportsAndRulesView } from '../features/imports/ImportsAndRulesView.js';
import { BudgetsAndGoalsView } from '../features/budgets/BudgetsAndGoalsView.js';
import { ReportsAndSyncView } from '../features/reports/ReportsAndSyncView.js';
import { SettingsView } from '../features/settings/SettingsView.js';
import {
  Home,
  Wallet,
  ArrowLeftRight,
  FileSpreadsheet,
  PieChart,
  BarChart3,
  Settings,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Command,
  Send,
  LogOut,
  PanelLeft,
  PanelRight,
  Plus,
  ChevronRight,
  ChevronsUpDown,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', railLabel: 'Home', label: 'Dashboard', icon: Home },
  { id: 'accounts', railLabel: 'Accounts', label: 'Accounts & Loans', icon: Wallet },
  { id: 'transactions', railLabel: 'Ledger', label: 'Ledger & Splits', icon: ArrowLeftRight },
  { id: 'imports', railLabel: 'Imports', label: 'Imports & Rules', icon: FileSpreadsheet },
  { id: 'budgets', railLabel: 'Budgets', label: 'Budgets & Goals', icon: PieChart },
  { id: 'reports', railLabel: 'Reports', label: 'Reports & Sync', icon: BarChart3 },
] as const;

type NavTabId = (typeof NAV_ITEMS)[number]['id'] | 'settings';
type SidebarFilter = 'ALL' | 'ASSET' | 'LIABILITY';

const ACCOUNT_GROUP_LABELS: Record<string, string> = {
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

const ACCOUNT_GROUP_META: Record<string, { icon: string; color: string }> = {
  DEPOSITORY: { icon: 'Wallet', color: '#078C52' },
  INVESTMENT: { icon: 'TrendingUp', color: '#3b82f6' },
  CRYPTO: { icon: 'Coins', color: '#f59e0b' },
  PROPERTY: { icon: 'Home', color: '#8b5cf6' },
  VEHICLE: { icon: 'Car', color: '#14b8a6' },
  OTHER_ASSET: { icon: 'Package', color: '#6b7280' },
  CREDIT_CARD: { icon: 'CreditCard', color: '#f97316' },
  LOAN: { icon: 'Landmark', color: '#ef4444' },
  OTHER_LIABILITY: { icon: 'Shapes', color: '#64748b' },
};

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
  const pct =
    Math.abs(first) >= 0.01 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const isFlat = Math.abs(pct) < 0.05;
  const isPositive = pct >= 0;
  const trendColor = isFlat ? '#71717a' : isPositive ? '#078C52' : '#E24056';

  return (
    <div className="shrink-0 flex flex-col items-end">
      <div
        className={`text-xs font-mono-tabular font-medium ${
          hoveredVal !== null ? 'text-[var(--text-primary)] underline decoration-dotted' : 'text-[var(--text-primary)]'
        }`}
      >
        <MoneyAmount
          value={hoveredVal !== null ? hoveredVal.toFixed(2) : value}
          currency={currency}
        />
      </div>
      <div
        className="flex items-center gap-1.5 mt-0.5"
        onClick={(e) => e.stopPropagation()}
      >
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
          {isFlat ? '0.0%' : `${pct > 0 ? '' : ''}${pct.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
};

const SureWorkspaceShell: React.FC = () => {
  const { session, logout } = useAuth();
  const { family, accounts, updateFamilySettings, lastError, clearError, isLoading } = useLedger();
  const { enabled: privacyEnabled, toggle: togglePrivacy } = usePrivacyMode();
  const { resolvedTheme, toggleDark } = useTheme();
  const darkMode = resolvedTheme === 'dark';

  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true);
  const [mobileLeftOpen, setMobileLeftOpen] = useState<boolean>(false);
  const [showAiSidebar, setShowAiSidebar] = useState<boolean>(false);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      role: 'USER' | 'ASSISTANT';
      text: string;
      toolCalled?: string;
    }>
  >([
    {
      id: 'm-1',
      role: 'ASSISTANT',
      text: 'Welcome to Sure AI Financial Assistant. Ask me about your Net Worth, Cash Flow Sankey, Budget Rollovers, or ask me to create rules and transactions.',
      toolCalled: 'get_balance_sheet',
    },
  ]);

  // Global Command Palette Shortcut: Cmd+K / Ctrl+K (DESIGN-SYSTEM.md Section 6)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !family.aiEnabled) return;
    const userPrompt = chatInput.trim();
    setChatInput('');

    setChatMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'USER', text: userPrompt },
    ]);

    try {
      const chat = await apiRequest<{
        messages: Array<{
          id: string;
          role: 'USER' | 'ASSISTANT';
          content: string;
          toolCalls?: Array<{ toolName: string }> | null;
        }>;
      }>('/api/v1/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: userPrompt }),
      });

      const assistantMsg = [...(chat.messages ?? [])]
        .reverse()
        .find((m) => m.role === 'ASSISTANT');

      if (assistantMsg) {
        const toolCalled = Array.isArray(assistantMsg.toolCalls)
          ? assistantMsg.toolCalls.map((t) => t.toolName).join(' & ')
          : undefined;
        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantMsg.id,
            role: 'ASSISTANT',
            text: assistantMsg.content,
            toolCalled,
          },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'ASSISTANT',
          text: err instanceof Error ? err.message : 'Unable to reach AI Assistant endpoint.',
        },
      ]);
    }
  };

  const activeNavMeta = useMemo(() => {
    if (activeTab === 'settings') {
      return { id: 'settings' as const, railLabel: 'Settings', label: 'Family & Security' };
    }
    return NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  }, [activeTab]);

  const groupedAccounts = useMemo(() => {
    const filtered = accounts.filter((acc) => {
      if (sidebarFilter === 'ASSET') return acc.classification === 'ASSET';
      if (sidebarFilter === 'LIABILITY') return acc.classification === 'LIABILITY';
      return true;
    });

    const map = new Map<string, { type: string; label: string; accounts: WebAccount[]; total: string; sparkline: number[] }>();
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

  const renderAccountSidebarContent = () => (
    <div className="flex flex-col h-full justify-between p-4 gap-4">
      <div className="space-y-4 overflow-y-auto pr-0.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {family.name}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {accounts.length} accounts • {family.baseCurrency}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setActiveTab('accounts');
              setMobileLeftOpen(false);
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
                setActiveTab('accounts');
                setMobileLeftOpen(false);
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
                      currency={family.baseCurrency}
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
                              setSelectedAccountId(acc.id);
                              setActiveTab('accounts');
                              setMobileLeftOpen(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedAccountId(acc.id);
                                setActiveTab('accounts');
                                setMobileLeftOpen(false);
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
          <div className="font-medium text-[var(--text-primary)] truncate">
            {session?.user.name}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] truncate">
            {session?.role} • {family.members.length} members
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setActiveTab('settings');
            setMobileLeftOpen(false);
          }}
          className="px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
        >
          Manage
        </button>
      </div>
    </div>
  );

  const renderAiAssistantBody = () => (
    <div className="relative flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <img
            src={darkMode ? '/images/ai-dark.svg' : '/images/ai.svg'}
            alt="Sure AI"
            className="w-5 h-5"
          />
          <div>
            <div className="text-sm font-semibold leading-tight">Sure AI Assistant</div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Ledger-aware financial copilot
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAiSidebar(false)}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
          aria-label="Close AI sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-xl text-sm whitespace-pre-line ${
              msg.role === 'USER'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] ml-8'
                : 'bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] mr-4'
            }`}
          >
            {msg.toolCalled && (
              <div className="mb-1.5">
                <Pill label={`Tool: ${msg.toolCalled}`} color="#078C52" />
              </div>
            )}
            {msg.text}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSendAiMessage}
        className="flex items-center gap-2 pt-3 border-t border-[var(--border-primary)]"
      >
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          disabled={!family.aiEnabled}
          placeholder="Ask about Net Worth, Cash Flow, or Budgets..."
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] disabled:opacity-50"
        />
        <Button type="submit" size="md" disabled={!family.aiEnabled} icon={<Send className="w-4 h-4" />}>
          Send
        </Button>
      </form>

      {!family.aiEnabled && (
        <div className="absolute inset-0 z-10 backdrop-blur-md bg-[var(--bg-canvas)]/75 flex items-center justify-center p-5">
          <div className="w-full p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <img
                src={darkMode ? '/images/ai-dark.svg' : '/images/ai.svg'}
                alt=""
                className="w-5 h-5"
              />
              <h3 className="text-sm font-semibold">AI Consent Required</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Your family ledger is private by default. Opt in to allow Sure AI to query balances,
              cash flow, and budgets using <code>family.aiEnabled</code>.
            </p>
            <Button
              size="sm"
              className="w-full justify-center"
              onClick={() => void updateFamilySettings({ aiEnabled: true })}
            >
              Enable Sure AI
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const isSettingsView = activeTab === 'settings';

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-16 lg:pb-0">
      {/* 1. Slim Desktop Icon Rail (matches layouts/application.html.erb w-[84px]) */}
      <aside className="no-print hidden lg:flex flex-col justify-between shrink-0 w-[84px] py-4 border-r border-[var(--border-primary)] bg-[var(--bg-canvas)] sticky top-0 h-screen">
        <div className="flex flex-col items-center gap-5">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
            title="Sure Home"
          >
            <img src="/images/logomark-color.svg" alt="Sure" className="w-8 h-8" />
          </button>

          <nav className="w-full flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className="group relative flex flex-col items-center justify-center gap-1 py-1 px-1 cursor-pointer"
                >
                  <span
                    className={`absolute left-0 top-2.5 w-1 h-4 rounded-r-sm transition-opacity ${
                      active
                        ? 'bg-[var(--text-primary)] opacity-100'
                        : 'opacity-0 group-hover:opacity-30 bg-[var(--text-secondary)]'
                    }`}
                  />
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                      active
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)] group-hover:bg-[var(--bg-surface-hover)] group-hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span
                    className={`text-[11px] font-medium leading-tight ${
                      active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {item.railLabel}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer ${
              isSettingsView ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
            aria-label="Open Settings"
          >
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                isSettingsView
                  ? 'bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-xs'
                  : ''
              }`}
            >
              <Settings className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-medium">Settings</span>
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] cursor-pointer"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. Collapsible Left Accounts Sidebar (Desktop, hidden inside Settings split view) */}
      {showLeftSidebar && !isSettingsView && (
        <aside className="no-print hidden lg:block w-[290px] shrink-0 border-r border-[var(--border-primary)] bg-[var(--bg-canvas)] sticky top-0 h-screen">
          {renderAccountSidebarContent()}
        </aside>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header with Breadcrumbs & Controls */}
        <header className="no-print sticky top-0 z-10 h-14 px-4 sm:px-6 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {!isSettingsView && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setMobileLeftOpen(true);
                  } else {
                    setShowLeftSidebar((v) => !v);
                  }
                }}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] cursor-pointer"
                aria-label={showLeftSidebar ? 'Hide Accounts Sidebar' : 'Show Accounts Sidebar'}
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm truncate">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer font-medium"
              >
                Home
              </button>
              {activeTab !== 'dashboard' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  {activeTab === 'accounts' ? (
                    <>
                      <span className="font-medium text-[var(--text-secondary)] shrink-0">
                        Accounts
                      </span>
                      {(accounts.find((a) => a.id === selectedAccountId) ?? accounts[0]) && (
                        <>
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                          <span className="font-semibold text-[var(--text-primary)] truncate">
                            {(accounts.find((a) => a.id === selectedAccountId) ?? accounts[0])?.name}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {activeNavMeta.label}
                    </span>
                  )}
                </>
              )}
            </nav>

            <div className="hidden md:block ml-2">
              <Pill label={family.baseCurrency} color="#078C52" size="xs" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] cursor-pointer"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Quick jump</span>
              <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono-tabular rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={togglePrivacy}
              aria-label="Toggle Privacy Mode"
              className={`focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-xs px-2.5 h-7 cursor-pointer border ${
                privacyEnabled
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] border-transparent'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-strong)]'
              }`}
            >
              {privacyEnabled ? (
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Eye className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden md:inline">
                {privacyEnabled ? 'Hidden' : 'Privacy'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleDark}
              aria-label="Toggle color theme"
              className="focus-ring inline-flex items-center justify-center rounded-md font-medium text-xs px-2.5 h-7 cursor-pointer bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            >
              {darkMode ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowAiSidebar((v) => !v)}
              aria-label="Toggle Sure AI Assistant"
              className={`focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-xs px-2.5 h-7 cursor-pointer border ${
                showAiSidebar
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] border-transparent'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-strong)]'
              }`}
            >
              <img
                src={darkMode ? '/images/ai-dark.svg' : '/images/ai.svg'}
                alt=""
                className="w-4 h-4 shrink-0"
              />
              <span className="hidden sm:inline">AI</span>
              <PanelRight className="w-3.5 h-3.5 hidden lg:inline opacity-70" />
            </button>
          </div>
        </header>

        {/* Active View */}
        <main className={`flex-1 w-full mx-auto space-y-4 ${isSettingsView ? 'p-4 sm:p-6 max-w-6xl' : 'p-4 sm:p-6 max-w-7xl'}`}>
          {lastError && (
            <Alert
              variant="error"
              title="Synchronization Error"
              action={
                <Button size="sm" variant="secondary" onClick={clearError}>
                  Dismiss
                </Button>
              }
            >
              {lastError}
            </Alert>
          )}
          {isLoading ? (
            <div className="py-20 text-center text-sm text-[var(--text-secondary)]">
              Loading PostgreSQL ledger for {family.name}...
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  onNavigate={(tab) => setActiveTab(tab as NavTabId)}
                  onOpenAiDrawer={() => setShowAiSidebar(true)}
                />
              )}
              {activeTab === 'accounts' && (
                <AccountsView
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={setSelectedAccountId}
                />
              )}
              {activeTab === 'transactions' && <TransactionsView />}
              {activeTab === 'imports' && <ImportsAndRulesView />}
              {activeTab === 'budgets' && <BudgetsAndGoalsView />}
              {activeTab === 'reports' && <ReportsAndSyncView />}
              {activeTab === 'settings' && (
                <SettingsView
                  onBack={() => setActiveTab('dashboard')}
                  onSignOut={() => void logout()}
                  onOpenAccount={(accountId) => {
                    setSelectedAccountId(accountId);
                    setActiveTab('accounts');
                  }}
                  onNavigateToImports={() => setActiveTab('imports')}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* 4. Dockable Right AI Assistant Sidebar (Desktop) */}
      {showAiSidebar && (
        <aside className="no-print hidden lg:flex flex-col w-[360px] shrink-0 border-l border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 sticky top-0 h-screen">
          {renderAiAssistantBody()}
        </aside>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border-primary)] bg-[var(--bg-surface)]/95 backdrop-blur-sm flex items-center justify-around py-1.5 px-2">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
                active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.railLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
            isSettingsView ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Mobile Left Accounts Drawer */}
      <SlideOverDrawer
        open={mobileLeftOpen}
        onClose={() => setMobileLeftOpen(false)}
        title="Accounts & Balances"
        subtitle={family.name}
      >
        {renderAccountSidebarContent()}
      </SlideOverDrawer>

      {/* Mobile AI Drawer (only used below lg where docked pane is hidden) */}
      <div className="lg:hidden">
        <SlideOverDrawer
          open={showAiSidebar}
          onClose={() => setShowAiSidebar(false)}
          title="Sure AI Financial Assistant"
          subtitle="Ledger-aware financial copilot"
        >
          {renderAiAssistantBody()}
        </SlideOverDrawer>
      </div>

      {/* Global Command Palette Dialog (⌘K) */}
      <Dialog
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        title="Command Palette (⌘K)"
        description="Jump to any financial module or toggle global controls"
      >
        <div className="space-y-1.5">
          {[...NAV_ITEMS, { id: 'settings' as const, label: 'Family & Security', icon: Settings }].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setCmdOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span>Go to {item.label}</span>
                </span>
                <span className="text-xs font-mono-tabular text-[var(--text-muted)]">Enter</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              togglePrivacy();
              setCmdOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer"
          >
            <span className="font-medium">Toggle Global Privacy Mode Blur</span>
            <kbd className="text-xs font-mono-tabular text-[var(--text-muted)]">Shift + P</kbd>
          </button>
        </div>
      </Dialog>
    </div>
  );
};

const AuthenticatedWorkspace: React.FC = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-secondary)] text-sm">
        Verifying session...
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <LedgerProvider>
      <SureWorkspaceShell />
    </LedgerProvider>
  );
};

export const App: React.FC = () => (
  <ThemeProvider defaultTheme="system">
    <PrivacyModeProvider>
      <AuthProvider>
        <AuthenticatedWorkspace />
      </AuthProvider>
    </PrivacyModeProvider>
  </ThemeProvider>
);
