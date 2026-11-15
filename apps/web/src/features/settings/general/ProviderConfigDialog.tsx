import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog } from '@sure/ui';
import type { WebAccount, WebProviderConnection } from '../../../lib/ledger-context.js';

export interface ProviderConfigModalTarget {
  mode: 'create' | 'edit';
  providerKey: string;
  providerLabel: string;
  connection?: WebProviderConnection;
}

interface ProviderConfigDialogProps {
  target: ProviderConfigModalTarget | null;
  familyBaseCurrency: string;
  cryptoAccounts: WebAccount[];
  busy: boolean;
  errorText: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    institutionName: string;
    accountId?: string | null;
    config: {
      apiKey?: string;
      apiSecret?: string;
      useTestnet?: boolean;
      quoteCurrency?: string;
      targetAccountId?: string;
      tickers?: string[];
      baseCurrency?: string;
      targetCurrencies?: string[];
    };
  }) => Promise<void>;
}

const DEFAULT_YAHOO_TICKERS = 'BBCA.JK, BBRI.JK, BMRI.JK, TLKM.JK, VOO, AAPL';
const DEFAULT_FX_TARGETS = 'IDR, USD, SGD, EUR, GBP, JPY, AUD, MYR';

function appendUniqueCsvItems(current: string, additions: string[]): string {
  const existing = current
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const set = new Set(existing);
  for (const item of additions) {
    set.add(item.toUpperCase());
  }
  return Array.from(set).join(', ');
}

export const ProviderConfigDialog: React.FC<ProviderConfigDialogProps> = ({
  target,
  familyBaseCurrency,
  cryptoAccounts,
  busy,
  errorText,
  onClose,
  onSubmit,
}) => {
  const [institutionName, setInstitutionName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);
  const [quoteCurrency, setQuoteCurrency] = useState('USD');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [tickersInput, setTickersInput] = useState(DEFAULT_YAHOO_TICKERS);
  const [baseCurrency, setBaseCurrency] = useState(familyBaseCurrency || 'IDR');
  const [targetCurrenciesInput, setTargetCurrenciesInput] = useState(DEFAULT_FX_TARGETS);

  useEffect(() => {
    if (!target) return;
    const summary = target.connection?.configSummary;
    setInstitutionName(target.connection?.institutionName || target.providerLabel);
    setApiKey('');
    setApiSecret('');
    setUseTestnet(Boolean(summary?.useTestnet));
    setQuoteCurrency(summary?.quoteCurrency || 'USD');
    setTargetAccountId(summary?.targetAccountId || '');
    setTickersInput(
      summary?.tickers && summary.tickers.length > 0
        ? summary.tickers.join(', ')
        : DEFAULT_YAHOO_TICKERS
    );
    setBaseCurrency(summary?.baseCurrency || familyBaseCurrency || 'IDR');
    setTargetCurrenciesInput(
      summary?.targetCurrencies && summary.targetCurrencies.length > 0
        ? summary.targetCurrencies.join(', ')
        : DEFAULT_FX_TARGETS
    );
  }, [target, familyBaseCurrency]);

  const providerKey = target?.providerKey ?? '';
  const isBinance = providerKey === 'binance';
  const isYahoo = providerKey === 'yahoo_finance';
  const isFrankfurter = providerKey === 'frankfurter_fx';

  const handleSave = async () => {
    if (!target) return;
    const trimmedName = institutionName.trim() || target.providerLabel;

    if (isBinance) {
      await onSubmit({
        institutionName: trimmedName,
        accountId: targetAccountId || (target.mode === 'edit' ? null : undefined),
        config: {
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(apiSecret.trim() ? { apiSecret: apiSecret.trim() } : {}),
          useTestnet,
          quoteCurrency,
          ...(targetAccountId ? { targetAccountId } : {}),
        },
      });
      return;
    }

    if (isYahoo) {
      const tickers = tickersInput
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      await onSubmit({
        institutionName: trimmedName,
        config: { tickers },
      });
      return;
    }

    if (isFrankfurter) {
      const targetCurrencies = targetCurrenciesInput
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length === 3);
      await onSubmit({
        institutionName: trimmedName,
        config: {
          baseCurrency: baseCurrency.trim().toUpperCase() || 'IDR',
          targetCurrencies,
        },
      });
      return;
    }

    await onSubmit({
      institutionName: trimmedName,
      config: {},
    });
  };

  return (
    <Dialog
      open={Boolean(target)}
      onClose={onClose}
      title={
        target?.mode === 'edit'
          ? `Configure ${target.providerLabel}`
          : `Connect ${target?.providerLabel ?? 'Provider'}`
      }
      description={
        isBinance
          ? 'Store encrypted read-only Binance Spot API credentials to sync crypto balances & holdings.'
          : isYahoo
            ? 'Configure global & Indonesian (.JK) stock/ETF tickers to monitor and price holdings.'
            : isFrankfurter
              ? 'Monitor live daily FX rates and power multi-currency account conversions.'
              : 'Register or update this provider connection.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Saving...' : target?.mode === 'edit' ? 'Save Settings' : 'Connect Provider'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errorText && (
          <Alert variant="error" title="Configuration Error">
            {errorText}
          </Alert>
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Connection Label
          </label>
          <input
            type="text"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder={target?.providerLabel}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
        </div>

        {isBinance && (
          <>
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] p-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              In Binance <strong>API Management</strong>, create an API key with{' '}
              <strong>Enable Reading</strong> only (keep Spot/Margin Trading and Withdrawals
              disabled). Credentials are encrypted with AES-256-GCM before saving.
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Binance API Key
                {target?.connection?.hasCredentials && target.connection.maskedApiKey && (
                  <span className="ml-2 font-mono-tabular text-[var(--text-muted)]">
                    (Current: {target.connection.maskedApiKey})
                  </span>
                )}
              </label>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  target?.connection?.hasCredentials
                    ? 'Leave blank to keep existing API Key'
                    : 'Paste your Binance read-only API Key'
                }
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Binance API Secret
              </label>
              <input
                type="password"
                autoComplete="off"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={
                  target?.connection?.hasCredentials
                    ? 'Leave blank to keep existing API Secret'
                    : 'Paste your Binance API Secret'
                }
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] font-mono-tabular"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Target Crypto Account
                </label>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                >
                  <option value="">Auto-create CRYPTO account</option>
                  {cryptoAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Account Valuation Currency
                </label>
                <select
                  value={quoteCurrency}
                  onChange={(e) => setQuoteCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                >
                  <option value="USD">USD (auto-converts to {familyBaseCurrency})</option>
                  <option value="IDR">IDR</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useTestnet}
                onChange={(e) => setUseTestnet(e.target.checked)}
                className="rounded border-[var(--border-strong)]"
              />
              <span>Use Binance Spot Testnet (testnet.binance.vision)</span>
            </label>
          </>
        )}

        {isYahoo && (
          <div className="space-y-2.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Stock & ETF Ticker Watchlist (comma-separated)
            </label>
            <textarea
              rows={3}
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="BBCA.JK, BBRI.JK, TLKM.JK, VOO, AAPL"
              className="w-full px-3 py-2 text-xs rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] font-mono-tabular"
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setTickersInput((prev) =>
                    appendUniqueCsvItems(prev, ['BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'TLKM.JK', 'ASII.JK'])
                  )
                }
              >
                + IDX Blue Chips
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setTickersInput((prev) => appendUniqueCsvItems(prev, ['VOO', 'QQQ', 'AAPL', 'NVDA']))
                }
              >
                + US ETFs & Tech
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setTickersInput((prev) => appendUniqueCsvItems(prev, ['BTC-USD', 'ETH-USD']))
                }
              >
                + Crypto Quotes
              </Button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Any equity/ETF holdings already tracked in your Investment accounts are automatically
              included during sync.
            </p>
          </div>
        )}

        {isFrankfurter && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Base Currency
              </label>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
              >
                {['IDR', 'USD', 'SGD', 'EUR', 'GBP', 'JPY', 'AUD'].map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Target Currencies (3-letter ISO codes, comma-separated)
              </label>
              <input
                type="text"
                value={targetCurrenciesInput}
                onChange={(e) => setTargetCurrenciesInput(e.target.value)}
                placeholder="IDR, USD, SGD, EUR, GBP, JPY, AUD, MYR"
                className="w-full px-3 py-2 text-xs rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] font-mono-tabular"
              />
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setTargetCurrenciesInput(DEFAULT_FX_TARGETS)}
            >
              Reset Major + IDR Preset
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
