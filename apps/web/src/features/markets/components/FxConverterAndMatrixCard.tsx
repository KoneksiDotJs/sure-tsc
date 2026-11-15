import React, { useMemo, useState } from 'react';
import { Card, MoneyAmount, MoneyField } from '@sure/ui';
import { ArrowLeftRight } from 'lucide-react';
import type { WebExchangeRateItem } from '../../../lib/ledger/types.js';
import {
  convertAmountViaRates,
  formatFxRateDisplay,
  type SelectedMarketTarget,
} from '../marketTypes.js';

interface FxConverterAndMatrixCardProps {
  familyBaseCurrency: string;
  exchangeRates: WebExchangeRateItem[];
  onSelectFxTarget: (target: SelectedMarketTarget) => void;
}

const DEFAULT_CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'JPY', 'GBP', 'AUD', 'MYR'];

export const FxConverterAndMatrixCard: React.FC<FxConverterAndMatrixCardProps> = ({
  familyBaseCurrency,
  exchangeRates,
  onSelectFxTarget,
}) => {
  const base = familyBaseCurrency.toUpperCase();
  const [amount, setAmount] = useState('1000.0000');
  const [fromCurrency, setFromCurrency] = useState(base === 'USD' ? 'EUR' : 'USD');
  const [toCurrency, setToCurrency] = useState(base);

  const currencies = useMemo(() => {
    const set = new Set<string>([base, ...DEFAULT_CURRENCIES]);
    for (const r of exchangeRates) {
      set.add(r.baseCurrency.toUpperCase());
      set.add(r.targetCurrency.toUpperCase());
    }
    return Array.from(set).sort();
  }, [base, exchangeRates]);

  const conversion = useMemo(
    () => convertAmountViaRates(amount, fromCurrency, toCurrency, exchangeRates),
    [amount, fromCurrency, toCurrency, exchangeRates]
  );

  const matrixRows = useMemo(() => {
    return currencies
      .filter((c) => c !== base)
      .map((curr) => {
        const direct = convertAmountViaRates('1.0000', curr, base, exchangeRates);
        return direct
          ? { from: curr, to: base, rate: direct.rate, date: direct.date }
          : null;
      })
      .filter(
        (item): item is { from: string; to: string; rate: string; date: string | null } =>
          item !== null
      )
      .slice(0, 8);
  }, [currencies, base, exchangeRates]);

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <Card
      title="FX Currency Converter & Matrix"
      subtitle={`Exact Decimal conversion anchored to ${base}`}
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                From Currency
              </label>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full h-9 px-2.5 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap currencies"
              className="h-9 px-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-nav-active)] text-[var(--text-secondary)] flex items-center justify-center"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                To Currency
              </label>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full h-9 px-2.5 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <MoneyField
            label={`Amount (${fromCurrency})`}
            value={amount}
            onChange={setAmount}
            currency={fromCurrency}
          />

          <div className="pt-2 border-t border-[var(--border-primary)] flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-secondary)]">Converted Result</span>
            {conversion ? (
              <div className="text-right">
                <div className="text-base font-semibold text-[var(--text-primary)]">
                  <MoneyAmount value={conversion.converted} currency={toCurrency} />
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                  1 {fromCurrency} = {formatFxRateDisplay(conversion.rate)} {toCurrency}
                  {conversion.date ? ` · ${conversion.date}` : ''}
                </div>
              </div>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">
                Sync Exchange Rates to compute pair
              </span>
            )}
          </div>
        </div>

        {matrixRows.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Cross Rates vs {base} (Click row to chart)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {matrixRows.map((row) => (
                <button
                  key={`${row.from}-${row.to}`}
                  type="button"
                  onClick={() => onSelectFxTarget({ kind: 'fx', from: row.from, to: row.to })}
                  title={row.date ? `Synced rate as of ${row.date}` : undefined}
                  className="text-left px-2.5 py-2 rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-semibold font-mono-tabular text-[var(--text-primary)]">
                      {row.from}/{row.to}
                    </div>
                    {row.date && (
                      <div className="text-[10px] text-[var(--text-muted)] font-mono-tabular">
                        {row.date}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                    {formatFxRateDisplay(row.rate)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
