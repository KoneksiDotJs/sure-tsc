import React from 'react';
import { Button, Card, MoneyAmount, Pill } from '@sure/ui';
import { ArrowRightLeft, RefreshCw, TrendingUp } from 'lucide-react';
import type { WebExchangeRateItem, WebMarketQuote } from '../../../lib/ledger-context.js';

interface MarketAndFxMonitorCardsProps {
  familyBaseCurrency: string;
  marketQuotes: WebMarketQuote[];
  exchangeRates: WebExchangeRateItem[];
  syncBusy: boolean;
  onRefreshAll: () => Promise<void>;
}

function formatFxRate(rate: string): string {
  const num = Number(rate);
  if (!Number.isFinite(num)) return rate;
  if (num >= 100) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (num >= 1) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
}

export const MarketAndFxMonitorCards: React.FC<MarketAndFxMonitorCardsProps> = ({
  familyBaseCurrency,
  marketQuotes,
  exchangeRates,
  syncBusy,
  onRefreshAll,
}) => {
  if (marketQuotes.length === 0 && exchangeRates.length === 0) {
    return null;
  }

  const base = familyBaseCurrency.toUpperCase();
  const prioritizedFx = exchangeRates
    .filter((r) => r.targetCurrency === base || r.baseCurrency === base)
    .slice(0, 12);
  const displayedFx = prioritizedFx.length > 0 ? prioritizedFx : exchangeRates.slice(0, 12);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card
        title="Stock & Crypto Market Monitor"
        subtitle="Latest synced prices from Yahoo Finance & Binance"
        action={
          <Button
            size="sm"
            variant="ghost"
            disabled={syncBusy}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />}
            onClick={() => void onRefreshAll()}
          >
            Refresh
          </Button>
        }
      >
        {marketQuotes.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
            Connect <strong>Yahoo Finance Quotes</strong> or <strong>Binance</strong> and click{' '}
            <strong>Sync</strong> to populate live market quotes.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)] max-h-[300px] overflow-y-auto pr-1">
            {marketQuotes.map((q) => (
              <div key={q.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[var(--text-primary)] font-mono-tabular">
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
                </div>
                <MoneyAmount
                  value={q.currentPrice}
                  currency={q.currency}
                  className="text-xs font-semibold font-mono-tabular shrink-0"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Currency Exchange Rates"
        subtitle={`Live FX pairs powering ${base} balance conversions`}
        action={
          <Button
            size="sm"
            variant="ghost"
            disabled={syncBusy}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />}
            onClick={() => void onRefreshAll()}
          >
            Refresh
          </Button>
        }
      >
        {displayedFx.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
            Connect <strong>Frankfurter ECB Exchange Rates</strong> and click <strong>Sync</strong>{' '}
            to monitor live FX rates.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)] max-h-[300px] overflow-y-auto pr-1">
            {displayedFx.map((fx) => (
              <div
                key={`${fx.baseCurrency}-${fx.targetCurrency}`}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] font-mono-tabular">
                      1 {fx.baseCurrency} → {fx.targetCurrency}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                      As of {fx.date}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)] font-mono-tabular">
                  {formatFxRate(fx.rate)} {fx.targetCurrency}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
