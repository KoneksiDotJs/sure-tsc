import React from 'react';
import { Pill } from '@sure/ui';
import {
  ChevronRight,
  Command,
  Eye,
  EyeOff,
  Moon,
  PanelLeft,
  PanelRight,
  Sun,
  TrendingUp,
} from 'lucide-react';
import type { NavTabId } from './navigation.js';

interface AppHeaderProps {
  activeTab: NavTabId;
  activeNavLabel: string;
  selectedAccountName?: string;
  baseCurrency: string;
  isSettingsView: boolean;
  showLeftSidebar: boolean;
  showMarketSidebar: boolean;
  showAiSidebar: boolean;
  privacyEnabled: boolean;
  darkMode: boolean;
  onToggleLeftSidebar: () => void;
  onNavigateDashboard: () => void;
  onOpenCommandPalette: () => void;
  onTogglePrivacy: () => void;
  onToggleDark: () => void;
  onToggleMarketSidebar: () => void;
  onToggleAiSidebar: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  activeNavLabel,
  selectedAccountName,
  baseCurrency,
  isSettingsView,
  showLeftSidebar,
  showMarketSidebar,
  showAiSidebar,
  privacyEnabled,
  darkMode,
  onToggleLeftSidebar,
  onNavigateDashboard,
  onOpenCommandPalette,
  onTogglePrivacy,
  onToggleDark,
  onToggleMarketSidebar,
  onToggleAiSidebar,
}) => (
  <header className="no-print sticky top-0 z-10 h-14 px-4 sm:px-6 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm flex items-center justify-between gap-3">
    <div className="flex items-center gap-2.5 min-w-0">
      {!isSettingsView && (
        <button
          type="button"
          onClick={onToggleLeftSidebar}
          className="p-1.5 rounded-lg text-[var(--text-secondary)] cursor-pointer"
          aria-label={
            activeTab === 'markets'
              ? showLeftSidebar
                ? 'Hide Markets Sidebar'
                : 'Show Markets Sidebar'
              : showLeftSidebar
                ? 'Hide Accounts Sidebar'
                : 'Show Accounts Sidebar'
          }
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm truncate">
        <button
          type="button"
          onClick={onNavigateDashboard}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer font-medium"
        >
          Home
        </button>
        {activeTab !== 'dashboard' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            {activeTab === 'accounts' ? (
              <>
                <span className="font-medium text-[var(--text-secondary)] shrink-0">Accounts</span>
                {selectedAccountName && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {selectedAccountName}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {activeNavLabel}
              </span>
            )}
          </>
        )}
      </nav>

      <div className="hidden md:block ml-2">
        <Pill label={baseCurrency} color="#078C52" size="xs" />
      </div>
    </div>

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenCommandPalette}
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
        onClick={onTogglePrivacy}
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
        <span className="hidden md:inline">{privacyEnabled ? 'Hidden' : 'Privacy'}</span>
      </button>

      <button
        type="button"
        onClick={onToggleDark}
        aria-label="Toggle color theme"
        className="focus-ring inline-flex items-center justify-center rounded-md font-medium text-xs px-2.5 h-7 cursor-pointer bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
      >
        {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>

      <button
        type="button"
        onClick={onToggleMarketSidebar}
        aria-label="Toggle Markets & FX Sidebar"
        className={`focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-xs px-2.5 h-7 cursor-pointer border ${
          showMarketSidebar
            ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] border-transparent'
            : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-strong)]'
        }`}
      >
        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Markets</span>
      </button>

      <button
        type="button"
        onClick={onToggleAiSidebar}
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
);
