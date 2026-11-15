import React, { useMemo, useState } from 'react';
import { Button, MoneyAmount, Pill } from '@sure/ui';
import { ArrowRightLeft, ExternalLink, Plus, RefreshCw, TrendingUp, X } from 'lucide-react';
import { useLedger } from '../../lib/ledger-context.js';
import {
  classifyQuoteGroup,
  convertAmountViaRates,
  formatFxRateDisplay,
  type MarketCategoryFilter,
  type SelectedMarketTarget,
} from './marketTypes.js';

interface MarketQuickDrawerProps {
  onClose?: () => void;
  onOpenMarketTarget: (target: SelectedMarketTarget | null) => void;
}

const FILTER_TABS: Array<{ id: MarketCategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'idx', label: 'IDX' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'global', label: 'Stocks' },
  { id: 'fx', label: 'FX' },
];

export const MarketQuickDrawer: React.FC<MarketQuickDrawerProps> = ({
  onClose,
  onOpenMarketTarget,
}) => {
  const {
    family,
    marketQuotes,
    exchangeRates,
    addWatchlistTicker,
    runSyncAll,
  } = useLedger();

  const base = family.baseCurrency.toUpperCase();
  const [filter, setFilter] = useState<MarketCategoryFilter>('all');
  const [fxAmount, setFxAmount] = useState('100');
  const [fxFrom, setFxFrom] = useState(base === 'USD' ? 'EUR' : 'USD');
  const [fxTo, setFxTo] = useState(base);
  const [syncBusy, setSyncBusy] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const currencies = useMemo(() => {
    const set = new Set<string>(['IDR', 'USD', 'EUR', 'SGD', 'JPY', 'GBP', base]);
    for (const r of exchangeRates) {
      set.add(r.baseCurrency.toUpperCase());
      set.add(r.targetCurrency.toUpperCase());
    }
    return Array.from(set).sort();
  }, [base, exchangeRates]);

  const quickFx = useMemo(
    () => convertAmountViaRates(fxAmount || '0', fxFrom, fxTo, exchangeRates),
    [fxAmount, fxFrom, fxTo, exchangeRates]
  );

  const visibleQuotes = useMemo(() => {
    if (filter === 'fx') return [];
    if (filter === 'all') return marketQuotes;
    return marketQuotes.filter((q) => classifyQuoteGroup(q) === filter);
  }, [filter, marketQuotes]);

  const visibleRates = useMemo(() => {
    if (filter !== 'all' && filter !== 'fx') return [];
    return [...exchangeRates]
      .sort((a, b) => {
        const aHit = a.targetCurrency.toUpperCase() === base || a.baseCurrency.toUpperCase() === base;
        const bHit = b.targetCurrency.toUpperCase() === base || b.baseCurrency.toUpperCase() === base;
        if (aHit !== bHit) return aHit ? -1 : 1;
        return `${a.baseCurrency}/${a.targetCurrency}`.localeCompare(`${b.baseCurrency}/${b.targetCurrency}`);
      })
      .slice(0, 12);
  }, [base, exchangeRates, filter]);

  const handleSync = async () => {
    setSyncBusy(true);
    try {
      await runSyncAll();
    } finally {
      setSyncBusy(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTicker.trim().toUpperCase();
    if (!trimmed) return;
    setAdding(true);
    setAddError(null);
    try {
      const quote = await addWatchlistTicker(trimmed);
      setNewTicker('');
      onOpenMarketTarget({ kind: 'security', ticker: quote.ticker });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Ticker lookup failed');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-primary)]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <TrendingUp className="w-4 h-4 text-[var(--brand-primary)]" />
            <span>Market & FX Pulse</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Quick watchlist & instant FX converter
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncBusy}
            title="Sync Markets & FX"
            className="p-1.5 rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />
          </button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onOpenMarketTarget(null)}
            icon={<ExternalLink className="w-3 h-3" />}
          >
            Full
          </Button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Markets Panel"
              className="hidden lg:inline-flex p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick FX Converter */}
      <div className="py-3 border-b border-[var(--border-primary)] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span>Quick FX Converter</span>
          <button
            type="button"
            onClick={() => {
              setFxFrom(fxTo);
              setFxTo(fxFrom);
            }}
            className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline normal-case font-medium"
          >
            <ArrowRightLeft className="w-3 h-3" /> Swap
          </button>
        </div>

        <div className="grid grid-cols-[1fr_76px_76px] gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={fxAmount}
            onChange={(e) => setFxAmount(e.target.value)}
            aria-label="FX conversion amount"
            className="h-8 px-2 text-xs font-mono-tabular rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"
          />
          <select
            value={fxFrom}
            onChange={(e) => setFxFrom(e.target.value)}
            aria-label="From currency"
            className="h-8 px-1.5 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={fxTo}
            onChange={(e) => setFxTo(e.target.value)}
            aria-label="To currency"
            className="h-8 px-1.5 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)]">
          <span className="text-[var(--text-muted)] font-mono-tabular">
            {quickFx ? `1 ${fxFrom} = ${formatFxRateDisplay(quickFx.rate)} ${fxTo}` : `${fxFrom}/${fxTo}`}
          </span>
          <span className="font-semibold text-[var(--text-primary)]">
            {quickFx ? <MoneyAmount value={quickFx.converted} currency={fxTo} /> : '—'}
          </span>
        </div>
      </div>

      {/* Add Ticker & Category Pills */}
      <div className="py-2.5 border-b border-[var(--border-primary)] space-y-2">
        <form onSubmit={(e) => void handleQuickAdd(e)} className="flex items-center gap-1.5">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            placeholder="Add ticker (BBCA.JK, BTC-USD)"
            className="flex-1 min-w-0 h-8 px-2.5 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={adding || !newTicker.trim()}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            {adding ? '...' : 'Add'}
          </Button>
        </form>
        {addError && <p className="text-[11px] text-[var(--status-negative)]">{addError}</p>}

        <div className="flex flex-wrap gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-primary)] py-1">
        {visibleQuotes.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onOpenMarketTarget({ kind: 'security', ticker: q.ticker })}
            className="w-full py-2 px-1.5 text-left hover:bg-[var(--bg-surface-subtle)] rounded-md transition-colors flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold font-mono-tabular text-[var(--text-primary)]">
                  {q.ticker}
                </span>
                <Pill
                  label={q.assetClass}
                  color={q.assetClass === 'CRYPTO' ? '#f59e0b' : '#3b82f6'}
                  size="xs"
                />
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">{q.name}</div>
            </div>
            <MoneyAmount
              value={q.currentPrice}
              currency={q.currency}
              className="text-xs font-semibold shrink-0"
            />
          </button>
        ))}

        {visibleRates.map((fx) => (
          <button
            key={`${fx.baseCurrency}-${fx.targetCurrency}`}
            type="button"
            onClick={() =>
              onOpenMarketTarget({
                kind: 'fx',
                from: fx.baseCurrency,
                to: fx.targetCurrency,
              })
            }
            className="w-full py-2 px-1.5 text-left hover:bg-[var(--bg-surface-subtle)] rounded-md transition-colors flex items-center justify-between gap-2"
          >
            <div>
              <div className="text-xs font-semibold font-mono-tabular text-[var(--text-primary)]">
                {fx.baseCurrency}/{fx.targetCurrency}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">FX Rate · {fx.date}</div>
            </div>
            <span className="text-xs font-semibold font-mono-tabular text-[var(--text-primary)]">
              {formatFxRateDisplay(fx.rate)}
            </span>
          </button>
        ))}

        {visibleQuotes.length === 0 && visibleRates.length === 0 && (
          <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
            No items match this filter yet.
          </div>
        )}
      </div>
    </div>
  );
};
