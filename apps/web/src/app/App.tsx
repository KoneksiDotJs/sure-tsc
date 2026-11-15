import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Button,
  LocaleProvider,
  PrivacyModeProvider,
  SlideOverDrawer,
  ThemeProvider,
  useLocale,
  usePrivacyMode,
  useTheme,
} from '@sure/ui';
import { LedgerProvider, useLedger } from '../lib/ledger-context.js';
import { AuthProvider, useAuth } from '../features/auth/AuthContext.js';
import { AuthPage } from '../features/auth/AuthPage.js';
import { DashboardView } from '../features/dashboard/DashboardView.js';
import { AccountsView } from '../features/accounts/AccountsView.js';
import { TransactionsView } from '../features/transactions/TransactionsView.js';
import { ImportsAndRulesView } from '../features/imports/ImportsAndRulesView.js';
import { BudgetsAndGoalsView } from '../features/budgets/BudgetsAndGoalsView.js';
import { ReportsAndSyncView } from '../features/reports/ReportsAndSyncView.js';
import { SettingsView } from '../features/settings/SettingsView.js';
import { AiAssistantPanel } from '../features/ai/AiAssistantPanel.js';
import { NAV_ITEMS, type NavTabId } from './components/navigation.js';
import { AppAccountSidebar } from './components/AppAccountSidebar.js';
import { AppDesktopRail, AppMobileBottomBar } from './components/AppRailAndNav.js';
import { AppHeader } from './components/AppHeader.js';
import { QuickJumpModal } from './components/QuickJumpModal.js';
import { useWorkspaceAiChat } from './components/useWorkspaceAiChat.js';

const SureWorkspaceShell: React.FC = () => {
  const { session, logout } = useAuth();
  const { family, accounts, updateFamilySettings, lastError, clearError, isLoading } = useLedger();
  const { enabled: privacyEnabled, toggle: togglePrivacy } = usePrivacyMode();
  const { resolvedTheme, toggleDark } = useTheme();
  const { setLocale } = useLocale();
  const darkMode = resolvedTheme === 'dark';

  useEffect(() => {
    if (family.locale) {
      setLocale(family.locale);
    }
  }, [family.locale, setLocale]);

  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true);
  const [mobileLeftOpen, setMobileLeftOpen] = useState<boolean>(false);
  const [showAiSidebar, setShowAiSidebar] = useState<boolean>(false);
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);

  const aiChat = useWorkspaceAiChat(family.id, family.aiEnabled);

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

  const activeNavMeta = useMemo(() => {
    if (activeTab === 'settings') {
      return { id: 'settings' as const, railLabel: 'Settings', label: 'Family & Security' };
    }
    return NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  }, [activeTab]);

  const selectedAccountName = useMemo(
    () => (accounts.find((a) => a.id === selectedAccountId) ?? accounts[0])?.name,
    [accounts, selectedAccountId]
  );

  const isSettingsView = activeTab === 'settings';

  const accountSidebarNode = (
    <AppAccountSidebar
      familyName={family.name}
      baseCurrency={family.baseCurrency}
      memberCount={family.members.length}
      userName={session?.user.name}
      userRole={session?.role}
      accounts={accounts}
      activeTab={activeTab}
      selectedAccountId={selectedAccountId}
      onSelectAccount={setSelectedAccountId}
      onNavigate={setActiveTab}
      onCloseMobile={() => setMobileLeftOpen(false)}
    />
  );

  const aiAssistantNode = (
    <AiAssistantPanel
      familyName={family.name}
      aiEnabled={family.aiEnabled}
      darkMode={darkMode}
      messages={aiChat.chatMessages}
      input={aiChat.chatInput}
      isSending={aiChat.isAiSending}
      onInputChange={aiChat.setChatInput}
      onSend={(promptOverride) => void aiChat.sendMessage(promptOverride)}
      onClearChat={aiChat.clearChat}
      onEnableAi={() => void updateFamilySettings({ aiEnabled: true })}
      onOpenAiSettings={() => setActiveTab('settings')}
      onClose={() => setShowAiSidebar(false)}
    />
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-16 lg:pb-0">
      <AppDesktopRail
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onLogout={() => void logout()}
      />

      {showLeftSidebar && !isSettingsView && (
        <aside className="no-print hidden lg:block w-[290px] shrink-0 border-r border-[var(--border-primary)] bg-[var(--bg-canvas)] sticky top-0 h-screen">
          {accountSidebarNode}
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          activeTab={activeTab}
          activeNavLabel={activeNavMeta.label}
          selectedAccountName={selectedAccountName}
          baseCurrency={family.baseCurrency}
          isSettingsView={isSettingsView}
          showLeftSidebar={showLeftSidebar}
          showAiSidebar={showAiSidebar}
          privacyEnabled={privacyEnabled}
          darkMode={darkMode}
          onToggleLeftSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setMobileLeftOpen(true);
            } else {
              setShowLeftSidebar((v) => !v);
            }
          }}
          onNavigateDashboard={() => setActiveTab('dashboard')}
          onOpenCommandPalette={() => setCmdOpen(true)}
          onTogglePrivacy={togglePrivacy}
          onToggleDark={toggleDark}
          onToggleAiSidebar={() => setShowAiSidebar((v) => !v)}
        />

        <main
          className={`flex-1 w-full mx-auto space-y-4 ${
            isSettingsView ? 'p-4 sm:p-6 max-w-6xl' : 'p-4 sm:p-6 max-w-7xl'
          }`}
        >
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

      {showAiSidebar && (
        <aside className="no-print hidden lg:flex flex-col w-[410px] shrink-0 border-l border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 sticky top-0 h-screen overflow-hidden">
          {aiAssistantNode}
        </aside>
      )}

      <AppMobileBottomBar activeTab={activeTab} onNavigate={setActiveTab} />

      <SlideOverDrawer
        open={mobileLeftOpen}
        onClose={() => setMobileLeftOpen(false)}
        title="Accounts & Balances"
        subtitle={family.name}
      >
        {accountSidebarNode}
      </SlideOverDrawer>

      <div className="lg:hidden">
        <SlideOverDrawer
          open={showAiSidebar}
          onClose={() => setShowAiSidebar(false)}
          title="Sure AI Financial Assistant"
          subtitle="Ledger-aware financial copilot"
        >
          {aiAssistantNode}
        </SlideOverDrawer>
      </div>

      <QuickJumpModal
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={setActiveTab}
        onTogglePrivacy={togglePrivacy}
      />
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
    <LocaleProvider defaultLocale="en">
      <PrivacyModeProvider>
        <AuthProvider>
          <AuthenticatedWorkspace />
        </AuthProvider>
      </PrivacyModeProvider>
    </LocaleProvider>
  </ThemeProvider>
);
