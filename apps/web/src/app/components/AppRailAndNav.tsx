import React from 'react';
import { useLocale } from '@sure/ui';
import { LogOut, Settings } from 'lucide-react';
import { NAV_ITEMS, type NavTabId } from './navigation.js';

interface AppRailProps {
  activeTab: NavTabId;
  onNavigate: (tab: NavTabId) => void;
  onLogout: () => void;
}

export const AppDesktopRail: React.FC<AppRailProps> = ({
  activeTab,
  onNavigate,
  onLogout,
}) => {
  const { t } = useLocale();
  const isSettingsView = activeTab === 'settings';

  return (
    <aside className="no-print hidden lg:flex flex-col justify-between shrink-0 w-[84px] py-4 border-r border-[var(--border-primary)] bg-[var(--bg-canvas)] sticky top-0 h-screen">
      <div className="flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
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
                onClick={() => onNavigate(item.id)}
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
                  {t(item.railKey)}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate('settings')}
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
          <span className="text-[11px] font-medium">{t('nav.settings')}</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] cursor-pointer"
          aria-label="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

export const AppMobileBottomBar: React.FC<{
  activeTab: NavTabId;
  onNavigate: (tab: NavTabId) => void;
}> = ({ activeTab, onNavigate }) => {
  const { t } = useLocale();
  const isSettingsView = activeTab === 'settings';

  return (
    <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border-primary)] bg-[var(--bg-surface)]/95 backdrop-blur-sm flex items-center justify-around py-1.5 px-2">
      {NAV_ITEMS.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
              active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{t(item.railKey)}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onNavigate('settings')}
        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
          isSettingsView ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        <Settings className="w-4 h-4" />
        <span>{t('nav.settings')}</span>
      </button>
    </nav>
  );
};
