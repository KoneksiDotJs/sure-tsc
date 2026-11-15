import React, { useEffect, useMemo, useState } from 'react';
import { isNegativeMoney, isPositiveMoney, toDecimal } from '@sure/shared';
import { Button, Card, MoneyAmount, Pill, ResponsiveAreaChart } from '@sure/ui';
import { RefreshCw } from 'lucide-react';
import type { WebMarketHistory, WebMarketHistoryRange } from '../../../lib/ledger/types.js';
import { formatFxRateDisplay, type SelectedMarketTarget } from '../marketTypes.js';

interface MarketChartCardProps {
  selectedTarget: SelectedMarketTarget | null;
  fetchMarketHistory: (query: {
    kind: 'security' | 'fx';
    ticker?: string;
    from?: string;
    to?: string;
    range?: WebMarketHistoryRange;
  }) => Promise<WebMarketHistory>;
}

const RANGES: Array<{ id: WebMarketHistoryRange; label: string }> = [
  { id: '5d', label: '5D' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: '1y', label: '1Y' },
];

export const MarketChartCard: React.FC<MarketChartCardProps> = ({
  selectedTarget,
  fetchMarketHistory,
}) => {
  const [range, setRange] = useState<WebMarketHistoryRange>('1mo');
  const [history, setHistory] = useState<WebMarketHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!selectedTarget) {
      setHistory(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const query =
      selectedTarget.kind === 'security'
        ? { kind: 'security' as const, ticker: selectedTarget.ticker, range }
        : {
            kind: 'fx' as const,
            from: selectedTarget.from,
            to: selectedTarget.to,
            range,
          };

    fetchMarketHistory(query)
      .then((res) => {
        if (!cancelled) {
          setHistory(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHistory(null);
          setError(err instanceof Error ? err.message : 'Failed to load market history');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTarget, range, reloadNonce, fetchMarketHistory]);

  const chartData = useMemo(() => {
    if (!history) return [];
    return history.points.map((p) => ({
      date: p.date,
      value: Number(toDecimal(p.close).toFixed(4)),
    }));
  }, [history]);

  if (!selectedTarget) {
    return (
      <Card
        title="Market Chart"
        subtitle="Select a stock, crypto asset, or FX pair from the sidebar"
      >
        <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
          Choose any ticker on the left watchlist (or add a new ticker like <code>BBCA.JK</code> or{' '}
          <code>BTC-USD</code>) to inspect historical price action.
        </div>
      </Card>
    );
  }

  const titleLabel =
    selectedTarget.kind === 'security'
      ? history?.symbol ?? selectedTarget.ticker
      : `${selectedTarget.from}/${selectedTarget.to}`;

  const subtitleLabel =
    selectedTarget.kind === 'security'
      ? history?.name ?? 'Historical closing prices'
      : `Historical FX Reference Rate (${selectedTarget.from} -> ${selectedTarget.to})`;

  const changePositive = history ? isPositiveMoney(history.changeAmount) : false;
  const changeNegative = history ? isNegativeMoney(history.changeAmount) : false;
  const chartColor = changeNegative ? '#ef4444' : '#10b981';

  const renderMetricValue = (val: string) => {
    if (!history) return val;
    if (history.kind === 'security') {
      return <MoneyAmount value={val} currency={history.currency} />;
    }
    return (
      <span className="font-mono-tabular">
        {formatFxRateDisplay(val)} {history.currency}
      </span>
    );
  };

  return (
    <Card
      title={titleLabel}
      subtitle={subtitleLabel}
      action={
        <div className="flex items-center gap-1.5">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                range === item.id
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Reload
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="py-10 text-center space-y-2">
          <p className="text-xs text-[var(--status-negative)]">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setReloadNonce((n) => n + 1)}>
            Retry
          </Button>
        </div>
      ) : loading && !history ? (
        <div className="h-[280px] flex items-center justify-center text-xs text-[var(--text-secondary)]">
          Loading historical {titleLabel} series...
        </div>
      ) : history ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <div className="text-2xl font-semibold text-[var(--text-primary)]">
                {renderMetricValue(history.latestClose)}
              </div>
              <Pill
                label={`${changePositive ? '+' : ''}${history.changePercent}%`}
                color={changeNegative ? '#ef4444' : '#10b981'}
                size="sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 text-right text-xs">
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Period Open</div>
                <div className="font-medium text-[var(--text-primary)]">
                  {renderMetricValue(history.periodOpen)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">High</div>
                <div className="font-medium text-[var(--text-primary)]">
                  {renderMetricValue(history.periodHigh)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Low</div>
                <div className="font-medium text-[var(--text-primary)]">
                  {renderMetricValue(history.periodLow)}
                </div>
              </div>
            </div>
          </div>

          <ResponsiveAreaChart
            data={chartData}
            height={260}
            color={chartColor}
            primaryLabel={titleLabel}
            formatValue={(val) =>
              history.kind === 'fx'
                ? `${formatFxRateDisplay(String(val))} ${history.currency}`
                : `${val.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${history.currency}`
            }
          />
        </div>
      ) : null}
    </Card>
  );
};
