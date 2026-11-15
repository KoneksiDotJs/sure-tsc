import React, { useMemo, useState } from 'react';
import { Button, MoneyAmount, Pill, SearchInput } from '@sure/ui';
import { ArrowRightLeft, Coins, Globe, Plus, RefreshCw, SlidersHorizontal, TrendingUp } from 'lucide-react';
import type {
  WebExchangeRateItem,
  WebFamilyHolding,
  WebMarketQuote,
} from '../../lib/ledger/types.js';
import {
  classifyQuoteGroup,
  formatFxRateDisplay,
  matchesMarketTarget,
  stripQuoteSuffix,
  type MarketCategoryFilter,
  type SelectedMarketTarget,
} from './marketTypes.js';

interface MarketsSidebarProps {
  familyBaseCurrency: string;
  marketQuotes: WebMarketQuote[];
  exchangeRates: WebExchangeRateItem[];
  familyHoldings: WebFamilyHolding[];
  selectedTarget: SelectedMarketTarget | null;
  onSelectTarget: (target: SelectedMarketTarget) => void;
  onAddTicker: (ticker: string) => Promise<WebMarketQuote>;
  onSyncAll: () => Promise<void>;
  onOpenSyncSettings: () => void;
  syncBusy: boolean;
}

const CATEGORY_OPTIONS: Array<{ id: MarketCategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'idx', label: 'IDX' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'global', label: 'Stocks' },
  { id: 'fx', label: 'FX' },
];

export const MarketsSidebar: React.FC<MarketsSidebarProps> = ({
  familyBaseCurrency,
  marketQuotes,
  exchangeRates,
  familyHoldings,
  selectedTarget,
  onSelectTarget,
  onAddTicker,
  onSyncAll,
  onOpenSyncSettings,
  syncBusy,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MarketCategoryFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const heldTickers = useMemo(() => {
    const set = new Set<string>();
    for (const h of familyHoldings) {
      set.add(h.ticker.toUpperCase());
      set.add(stripQuoteSuffix(h.ticker));
    }
    return set;
  }, [familyHoldings]);

  const query = search.trim().toLowerCase();

  const groupedQuotes = useMemo(() => {
    const idx: WebMarketQuote[] = [];
    const crypto: WebMarketQuote[] = [];
    const global: WebMarketQuote[] = [];

    for (const q of marketQuotes) {
      if (
        query &&
        !q.ticker.toLowerCase().includes(query) &&
        !q.name.toLowerCase().includes(query)
      ) {
        continue;
      }
      const grp = classifyQuoteGroup(q);
      if (grp === 'idx') idx.push(q);
      else if (grp === 'crypto') crypto.push(q);
      else global.push(q);
    }
    return { idx, crypto, global };
  }, [marketQuotes, query]);

  const filteredRates = useMemo(() => {
    const base = familyBaseCurrency.toUpperCase();
    const list = exchangeRates.filter((r) => {
      if (!query) return true;
      const pair = `${r.baseCurrency}/${r.targetCurrency}`.toLowerCase();
      return pair.includes(query) || r.baseCurrency.toLowerCase().includes(query) || r.targetCurrency.toLowerCase().includes(query);
    });
    return [...list].sort((a, b) => {
      const aMatch = a.targetCurrency.toUpperCase() === base || a.baseCurrency.toUpperCase() === base;
      const bMatch = b.targetCurrency.toUpperCase() === base || b.baseCurrency.toUpperCase() === base;
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      return `${a.baseCurrency}/${a.targetCurrency}`.localeCompare(`${b.baseCurrency}/${b.targetCurrency}`);
    });
  }, [exchangeRates, familyBaseCurrency, query]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTicker.trim().toUpperCase();
    if (!trimmed) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await onAddTicker(trimmed);
      setNewTicker('');
      setAddOpen(false);
      onSelectTarget({ kind: 'security', ticker: created.ticker });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to resolve ticker quote');
    } finally {
      setAdding(false);
    }
  };

  const renderSecuritySection = (
    title: string,
    items: WebMarketQuote[],
    icon: React.ReactNode
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="px-2 pt-2 pb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            {icon}
            {title}
          </span>
          <span className="font-mono-tabular">{items.length}</span>
        </div>
        {items.map((q) => {
          const target: SelectedMarketTarget = { kind: 'security', ticker: q.ticker };
          const active = matchesMarketTarget(selectedTarget, target);
          const isHeld =
            heldTickers.has(q.ticker.toUpperCase()) ||
            heldTickers.has(stripQuoteSuffix(q.ticker));

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectTarget(target)}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                active
                  ? 'bg-[var(--bg-nav-active)] text-[var(--text-primary)] ring-1 ring-[var(--border-secondary)]'
                  : 'hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold font-mono-tabular truncate">
                    {q.ticker}
                  </span>
                  {isHeld && <Pill label="HELD" color="#10b981" size="xs" />}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">{q.name}</div>
              </div>
              <MoneyAmount
                value={q.currentPrice}
                currency={q.currency}
                className="text-xs font-semibold shrink-0"
              />
            </button>
          );
        })}
      </div>
    );
  };

  const showIdx = category === 'all' || category === 'idx';
  const showCrypto = category === 'all' || category === 'crypto';
  const showGlobal = category === 'all' || category === 'global';
  const showFx = category === 'all' || category === 'fx';

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-4 pb-3 border-b border-[var(--border-primary)] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Watchlist & FX</h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Stocks, Crypto & Currency Rates
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              title="Add Ticker"
              className="p-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void onSyncAll()}
              disabled={syncBusy}
              title="Sync Live Market & FX Data"
              className="p-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {addOpen && (
          <form onSubmit={(e) => void handleAddSubmit(e)} className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="e.g. BBCA.JK, BTC-USD, NVDA"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
              <Button type="submit" size="sm" variant="primary" disabled={adding || !newTicker.trim()}>
                {adding ? '...' : 'Add'}
              </Button>
            </div>
            {addError && <p className="text-[11px] text-[var(--status-negative)]">{addError}</p>}
          </form>
        )}

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search ticker or FX pair..."
        />

        <div className="flex flex-wrap gap-1">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCategory(opt.id)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                category === opt.id
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {showIdx &&
          renderSecuritySection(
            'Indonesia IDX',
            groupedQuotes.idx,
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          )}
        {showCrypto &&
          renderSecuritySection(
            'Crypto Spot',
            groupedQuotes.crypto,
            <Coins className="w-3 h-3 text-amber-500" />
          )}
        {showGlobal &&
          renderSecuritySection(
            'Global Equities',
            groupedQuotes.global,
            <Globe className="w-3 h-3 text-sky-500" />
          )}

        {showFx && filteredRates.length > 0 && (
          <div className="space-y-1">
            <div className="px-2 pt-2 pb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-indigo-500" />
                FX Rates
              </span>
              <span className="font-mono-tabular">{filteredRates.length}</span>
            </div>
            {filteredRates.map((fx) => {
              const target: SelectedMarketTarget = {
                kind: 'fx',
                from: fx.baseCurrency,
                to: fx.targetCurrency,
              };
              const active = matchesMarketTarget(selectedTarget, target);
              return (
                <button
                  key={`${fx.baseCurrency}-${fx.targetCurrency}`}
                  type="button"
                  onClick={() => onSelectTarget(target)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                    active
                      ? 'bg-[var(--bg-nav-active)] text-[var(--text-primary)] ring-1 ring-[var(--border-secondary)]'
                      : 'hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold font-mono-tabular">
                      {fx.baseCurrency}/{fx.targetCurrency}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">{fx.date}</div>
                  </div>
                  <div className="text-right font-mono-tabular shrink-0">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      {formatFxRateDisplay(fx.rate)}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">{fx.targetCurrency}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {marketQuotes.length === 0 && exchangeRates.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-[var(--text-secondary)] space-y-2">
            <p>No live quotes or FX rates synced yet.</p>
            <Button size="sm" variant="secondary" onClick={onOpenSyncSettings}>
              Configure Feeds
            </Button>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onOpenSyncSettings}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Manage Market & FX Connections
        </button>
      </div>
    </div>
  );
};
