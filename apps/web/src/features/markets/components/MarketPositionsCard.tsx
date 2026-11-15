import React, { useMemo } from 'react';
import { Card, MoneyAmount, Pill } from '@sure/ui';
import { ArrowUpRight } from 'lucide-react';
import type { WebFamilyHolding } from '../../../lib/ledger/types.js';
import { stripQuoteSuffix, type SelectedMarketTarget } from '../marketTypes.js';

interface MarketPositionsCardProps {
  familyHoldings: WebFamilyHolding[];
  selectedTarget: SelectedMarketTarget | null;
  onSelectSecurity: (ticker: string) => void;
  onOpenAccount: (accountId: string) => void;
}

export const MarketPositionsCard: React.FC<MarketPositionsCardProps> = ({
  familyHoldings,
  selectedTarget,
  onSelectSecurity,
  onOpenAccount,
}) => {
  const selectedTicker =
    selectedTarget?.kind === 'security' ? selectedTarget.ticker.toUpperCase() : null;

  const matchedHoldings = useMemo(() => {
    if (!selectedTicker) return [];
    const selectedRoot = stripQuoteSuffix(selectedTicker);
    return familyHoldings.filter(
      (h) =>
        h.ticker.toUpperCase() === selectedTicker ||
        stripQuoteSuffix(h.ticker) === selectedRoot
    );
  }, [familyHoldings, selectedTicker]);

  return (
    <Card
      title="Portfolio Exposure & Holdings"
      subtitle="Synced Binance Spot & Brokerage positions for your family"
    >
      {matchedHoldings.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Active Position in {selectedTicker}
            </span>
            <Pill label={`${matchedHoldings.length} Account(s)`} color="#10b981" size="xs" />
          </div>
          {matchedHoldings.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-emerald-500/20"
            >
              <div>
                <div className="font-medium text-[var(--text-primary)]">{h.accountName}</div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                  Qty {h.qty} · Avg Cost <MoneyAmount value={h.avgCostBasis} currency={h.currency} />
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-[var(--text-primary)]">
                  <MoneyAmount value={h.marketValue} currency={h.currency} />
                </div>
                <div className="text-[11px] font-mono-tabular">
                  <MoneyAmount
                    value={h.unrealizedGain}
                    currency={h.currency}
                    colorize
                    showSign
                  />{' '}
                  <span className="text-[var(--text-muted)]">({h.returnPercent}%)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {familyHoldings.length === 0 ? (
        <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
          No investment or Binance crypto holdings recorded yet. Connect <strong>Binance</strong> or
          add holdings to an Investment account to track unrealized P&L here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-primary)] text-[11px] text-[var(--text-muted)]">
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 px-2 font-medium">Account</th>
                <th className="py-2 px-2 font-medium text-right">Qty</th>
                <th className="py-2 px-2 font-medium text-right">Market Value</th>
                <th className="py-2 pl-2 font-medium text-right">Unrealized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {familyHoldings.map((h) => (
                <tr key={h.id} className="hover:bg-[var(--bg-surface-subtle)] transition-colors">
                  <td className="py-2.5 pr-3">
                    <button
                      type="button"
                      onClick={() => onSelectSecurity(h.ticker)}
                      className="text-left group"
                    >
                      <div className="font-semibold font-mono-tabular text-[var(--text-primary)] group-hover:text-[var(--brand-primary)]">
                        {h.ticker}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]">
                        {h.securityName}
                      </div>
                    </button>
                  </td>
                  <td className="py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => onOpenAccount(h.accountId)}
                      className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <span className="truncate max-w-[110px]">{h.accountName}</span>
                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                    </button>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono-tabular text-[var(--text-secondary)]">
                    {h.qty}
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold">
                    <MoneyAmount value={h.marketValue} currency={h.currency} />
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    <div>
                      <MoneyAmount
                        value={h.unrealizedGain}
                        currency={h.currency}
                        colorize
                        showSign
                      />
                    </div>
                    <div className="text-[10px] font-mono-tabular text-[var(--text-muted)]">
                      {h.returnPercent}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
