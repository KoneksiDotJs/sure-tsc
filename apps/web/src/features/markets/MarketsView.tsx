import React from 'react';
import { Button, Card } from '@sure/ui';
import { RefreshCw, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { useLedger } from '../../lib/ledger-context.js';
import { MarketChartCard } from './components/MarketChartCard.js';
import { FxConverterAndMatrixCard } from './components/FxConverterAndMatrixCard.js';
import { MarketPositionsCard } from './components/MarketPositionsCard.js';
import type { SelectedMarketTarget } from './marketTypes.js';

interface MarketsViewProps {
  selectedTarget: SelectedMarketTarget | null;
  onSelectTarget: (target: SelectedMarketTarget) => void;
  onOpenAccount: (accountId: string) => void;
  onOpenSyncSettings: () => void;
  syncBusy: boolean;
  onSyncAll: () => Promise<void>;
}

export const MarketsView: React.FC<MarketsViewProps> = ({
  selectedTarget,
  onSelectTarget,
  onOpenAccount,
  onOpenSyncSettings,
  syncBusy,
  onSyncAll,
}) => {
  const {
    family,
    marketQuotes,
    exchangeRates,
    familyHoldings,
    fetchMarketHistory,
  } = useLedger();

  const hasData = marketQuotes.length > 0 || exchangeRates.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--brand-primary)]" />
            Markets & FX Intelligence
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Interactive historical charts, IDX & global stocks, Binance crypto prices, and live FX rates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpenSyncSettings}
            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
          >
            Manage Feeds
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={syncBusy}
            onClick={() => void onSyncAll()}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />}
          >
            {syncBusy ? 'Syncing...' : 'Sync Markets'}
          </Button>
        </div>
      </div>

      {!hasData && (
        <Card
          title="No Live Market or FX Feeds Connected Yet"
          subtitle="Enable Binance Spot, Yahoo Finance Quotes, or Frankfurter FX Rates in Bank sync"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs text-[var(--text-secondary)]">
            <span>
              You can also use the <strong>+</strong> button in the left Watchlist sidebar to look up
              any stock or crypto ticker immediately (e.g. <code>BBCA.JK</code>, <code>TLKM.JK</code>,{' '}
              <code>BTC-USD</code>).
            </span>
            <Button size="sm" variant="primary" onClick={onOpenSyncSettings}>
              Open Feed Setup
            </Button>
          </div>
        </Card>
      )}

      <MarketChartCard
        selectedTarget={selectedTarget}
        fetchMarketHistory={fetchMarketHistory}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <MarketPositionsCard
          familyHoldings={familyHoldings}
          selectedTarget={selectedTarget}
          onSelectSecurity={(ticker) => onSelectTarget({ kind: 'security', ticker })}
          onOpenAccount={onOpenAccount}
        />

        <FxConverterAndMatrixCard
          familyBaseCurrency={family.baseCurrency}
          exchangeRates={exchangeRates}
          onSelectFxTarget={onSelectTarget}
        />
      </div>
    </div>
  );
};
