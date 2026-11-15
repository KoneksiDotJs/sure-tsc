import React, { useEffect, useState } from 'react';
import { Button, useLocale } from '@sure/ui';
import { ArrowLeft, ArrowRight, ChevronLeft, LogOut, Plus, RefreshCw } from 'lucide-react';
import { useLedger } from '../../lib/ledger-context.js';
import {
  TransactionsSettingsSections,
  TransactionsSectionId,
} from './TransactionsSettingsSections.js';
import {
  AdvancedSettingsSections,
  AdvancedSectionId,
} from './AdvancedSettingsSections.js';
import { MoreSettingsSections } from './MoreSettingsSections.js';
import {
  DEFAULT_PREFS,
  FLAT_SECTIONS,
  LocalWorkspacePrefs,
  SETTINGS_NAV_GROUPS,
  SettingsSectionId,
} from './settings.nav.js';
import {
  AccountsSettingsSection,
  BankSyncSettingsSection,
} from './general/AccountsAndSyncSections.js';
import {
  AppearanceSection,
  PreferencesSection,
} from './general/PreferencesAndAppearanceSections.js';
import {
  ProfileSection,
  SecuritySection,
} from './general/ProfileAndSecuritySections.js';

export const SettingsView: React.FC<{
  initialSection?: SettingsSectionId;
  onBack?: () => void;
  onSignOut?: () => void;
  onOpenAccount?: (accountId: string) => void;
  onNavigateToImports?: () => void;
}> = ({ initialSection = 'accounts', onBack, onSignOut, onOpenAccount, onNavigateToImports }) => {
  const { t } = useLocale();
  const { family, runSyncAll } = useLedger();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

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

  const [createAccOpen, setCreateAccOpen] = useState<boolean>(false);
  const [syncBusy, setSyncBusy] = useState<boolean>(false);

  const [txActionTrigger, setTxActionTrigger] = useState<{
    section: TransactionsSectionId;
    tick: number;
  } | null>(null);

  const [advActionTrigger, setAdvActionTrigger] = useState<{
    section: AdvancedSectionId;
    tick: number;
  } | null>(null);

  useEffect(() => {
    if (!onBack) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const handleSyncAll = async () => {
    setSyncBusy(true);
    try {
      await runSyncAll();
    } finally {
      setSyncBusy(false);
    }
  };

  const activeIndex = FLAT_SECTIONS.findIndex((s) => s.id === activeSection);
  const activeNavItem = FLAT_SECTIONS[activeIndex] ?? FLAT_SECTIONS[0]!;
  const prevNavItem = activeIndex > 0 ? FLAT_SECTIONS[activeIndex - 1]! : null;
  const nextNavItem = activeIndex < FLAT_SECTIONS.length - 1 ? FLAT_SECTIONS[activeIndex + 1]! : null;

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 min-h-[75vh]">
      {/* Left Settings Sidebar */}
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
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                          active
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

        {activeSection === 'accounts' && (
          <AccountsSettingsSection
            onOpenAccount={onOpenAccount}
            createAccOpen={createAccOpen}
            onCloseCreateAcc={() => setCreateAccOpen(false)}
          />
        )}

        {activeSection === 'sync' && (
          <BankSyncSettingsSection syncBusy={syncBusy} onSyncAll={handleSyncAll} />
        )}

        {activeSection === 'preferences' && (
          <PreferencesSection prefs={prefs} updatePref={updatePref} />
        )}

        {activeSection === 'appearance' && (
          <AppearanceSection prefs={prefs} updatePref={updatePref} />
        )}

        {activeSection === 'profile' && <ProfileSection onSignOut={onSignOut} />}

        {activeSection === 'security' && <SecuritySection />}

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

        {(activeSection === 'guides' ||
          activeSection === 'whats_new' ||
          activeSection === 'feedback') && <MoreSettingsSections activeSection={activeSection} />}

        {/* Bottom Prev / Next Section Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {prevNavItem ? (
            <button
              type="button"
              onClick={() => setActiveSection(prevNavItem.id)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer ${
                !nextNavItem ? 'sm:col-span-2' : ''
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
    </div>
  );
};
