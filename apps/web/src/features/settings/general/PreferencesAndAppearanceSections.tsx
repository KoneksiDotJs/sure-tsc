import React, { useState } from 'react';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  getLocaleConfig,
  normalizeLocaleCode,
} from '@sure/shared';
import {
  Button,
  Card,
  Dialog,
  ThemePreference,
  Toggle,
  useLocale,
  useTheme,
} from '@sure/ui';
import { AlertTriangle } from 'lucide-react';
import { useLedger } from '../../../lib/ledger-context.js';
import type { LocalWorkspacePrefs } from '../settings.nav.js';

export const PreferencesSection: React.FC<{
  prefs: LocalWorkspacePrefs;
  updatePref: <K extends keyof LocalWorkspacePrefs>(key: K, value: LocalWorkspacePrefs[K]) => void;
}> = ({ prefs, updatePref }) => {
  const { locale, setLocale, t } = useLocale();
  const { family, updateFamilySettings } = useLedger();
  const [currencyModalOpen, setCurrencyModalOpen] = useState<boolean>(false);

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

      {/* Manage Family Currencies Modal */}
      <Dialog
        open={currencyModalOpen}
        onClose={() => setCurrencyModalOpen(false)}
        title="Manage Family Currencies"
        description="Set the household base currency and additional currencies available in money fields."
        footer={<Button onClick={() => setCurrencyModalOpen(false)}>Done</Button>}
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
                    className={`px-2.5 py-1 rounded-md text-xs font-mono-tabular border cursor-pointer ${
                      selected
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

export const AppearanceSection: React.FC<{
  prefs: LocalWorkspacePrefs;
  updatePref: <K extends keyof LocalWorkspacePrefs>(key: K, value: LocalWorkspacePrefs[K]) => void;
}> = ({ prefs, updatePref }) => {
  const { theme, setTheme } = useTheme();

  return (
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
                className={`text-center p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  active
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
  );
};
