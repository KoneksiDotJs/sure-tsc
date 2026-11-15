import React, { useMemo, useState } from 'react';
import { absMoney, calculateLoanAmortization } from '@sure/shared';
import { Button, Card, MoneyAmount, MoneyField } from '@sure/ui';
import { Plus } from 'lucide-react';
import { useLedger, WebAccount, WebHoldingsSummary } from '../../../lib/ledger-context.js';

export const AccountHoldingsTab: React.FC<{
  activeAccount: WebAccount;
  holdingsData: WebHoldingsSummary | null;
  holdingsLoading: boolean;
  onUpdateHoldings: (data: WebHoldingsSummary) => void;
}> = ({ activeAccount, holdingsData, holdingsLoading, onUpdateHoldings }) => {
  const { upsertAccountHolding } = useLedger();

  const [holdingTicker, setHoldingTicker] = useState<string>('');
  const [holdingName, setHoldingName] = useState<string>('');
  const [holdingQty, setHoldingQty] = useState<string>('10');
  const [holdingCost, setHoldingCost] = useState<string>('100.00');
  const [holdingPrice, setHoldingPrice] = useState<string>('115.00');

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdingTicker.trim()) return;
    const res = await upsertAccountHolding(activeAccount.id, {
      ticker: holdingTicker.trim().toUpperCase(),
      securityName: holdingName.trim() || holdingTicker.trim().toUpperCase(),
      assetClass: activeAccount.accountType === 'CRYPTO' ? 'CRYPTO' : 'EQUITY',
      qty: holdingQty,
      avgCostBasis: holdingCost,
      currentPrice: holdingPrice,
    });
    onUpdateHoldings(res);
    setHoldingTicker('');
    setHoldingName('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
            Market Value
          </div>
          <div className="text-lg font-bold mt-1">
            <MoneyAmount
              value={holdingsData?.totalMarketValue ?? '0.0000'}
              currency={activeAccount.currency}
            />
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
            Cost Basis
          </div>
          <div className="text-lg font-bold mt-1">
            <MoneyAmount
              value={holdingsData?.totalCostBasis ?? '0.0000'}
              currency={activeAccount.currency}
            />
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
            Unrealized Gain
          </div>
          <div
            className={`text-lg font-bold mt-1 ${
              Number(holdingsData?.totalGain ?? 0) >= 0
                ? 'text-[var(--status-positive)]'
                : 'text-[var(--status-negative)]'
            }`}
          >
            <MoneyAmount
              value={holdingsData?.totalGain ?? '0.0000'}
              currency={activeAccount.currency}
              showSign
            />
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
            Total Return
          </div>
          <div
            className={`text-lg font-bold mt-1 font-mono-tabular ${
              Number(holdingsData?.totalReturnPercent ?? 0) >= 0
                ? 'text-[var(--status-positive)]'
                : 'text-[var(--status-negative)]'
            }`}
          >
            {Number(holdingsData?.totalReturnPercent ?? 0) >= 0 ? '+' : ''}
            {Number(holdingsData?.totalReturnPercent ?? 0).toFixed(2)}%
          </div>
        </Card>
      </div>

      <Card title="Positions & Allocation">
        {holdingsLoading ? (
          <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Loading positions...
          </div>
        ) : !holdingsData || holdingsData.holdings.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
            No securities recorded yet. Add your first ticker below.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Ticker</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Avg Cost</th>
                  <th className="text-right px-3 py-2 font-medium">Price</th>
                  <th className="text-right px-3 py-2 font-medium">Market Value</th>
                  <th className="text-right px-3 py-2 font-medium">Gain (%)</th>
                  <th className="text-right px-3 py-2 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {holdingsData.holdings.map((h) => {
                  const isUp = Number(h.unrealizedGain) >= 0;
                  return (
                    <tr key={h.id}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[var(--text-primary)]">{h.ticker}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{h.securityName}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular">
                        {Number(h.qty).toFixed(4)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <MoneyAmount value={h.avgCostBasis} currency={h.currency} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <MoneyAmount value={h.currentPrice} currency={h.currency} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        <MoneyAmount value={h.marketValue} currency={h.currency} />
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono-tabular text-xs ${
                          isUp ? 'text-[var(--status-positive)]' : 'text-[var(--status-negative)]'
                        }`}
                      >
                        <MoneyAmount
                          value={h.unrealizedGain}
                          currency={h.currency}
                          showSign
                        />{' '}
                        ({isUp ? '+' : ''}
                        {Number(h.returnPercent).toFixed(2)}%)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular text-xs">
                        {Number(h.portfolioWeightPercent).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Add / Update Position" subtitle="Persists cost basis, share quantity & live valuation">
        <form onSubmit={handleAddHolding} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Ticker
            </label>
            <input
              type="text"
              required
              value={holdingTicker}
              onChange={(e) => setHoldingTicker(e.target.value)}
              placeholder="VTI / BTC"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Security Name
            </label>
            <input
              type="text"
              value={holdingName}
              onChange={(e) => setHoldingName(e.target.value)}
              placeholder="Vanguard Total Market"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Quantity
            </label>
            <input
              type="text"
              required
              value={holdingQty}
              onChange={(e) => setHoldingQty(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
            />
          </div>
          <MoneyField
            label="Avg Cost"
            value={holdingCost}
            onChange={setHoldingCost}
            currency={activeAccount.currency}
          />
          <MoneyField
            label="Current Price"
            value={holdingPrice}
            onChange={setHoldingPrice}
            currency={activeAccount.currency}
          />
          <Button type="submit" icon={<Plus className="w-4 h-4" />}>
            Save Position
          </Button>
        </form>
      </Card>
    </div>
  );
};

export const AccountLoanTab: React.FC<{ activeAccount: WebAccount }> = ({ activeAccount }) => {
  const [extraPayment, setExtraPayment] = useState<string>('500.00');

  const loanSchedule = useMemo(() => {
    const rate = String(activeAccount.subtypeDetails?.interestRatePercent ?? '6.0');
    const term = Number(activeAccount.subtypeDetails?.termMonths ?? 360);
    return calculateLoanAmortization({
      principal: absMoney(activeAccount.balance),
      annualInterestRatePercent: rate,
      termMonths: term,
      extraMonthlyPayment: extraPayment || '0',
    });
  }, [activeAccount, extraPayment]);

  return (
    <Card title="Loan Payoff Simulator" subtitle="Interactive Decimal-precision amortization schedule">
      <div className="space-y-4">
        <div className="max-w-md">
          <MoneyField
            label="Extra Monthly Principal Payment"
            value={extraPayment}
            onChange={setExtraPayment}
            currency={activeAccount.currency}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
            <div className="text-xs text-[var(--text-secondary)]">Standard Payment</div>
            <div className="text-lg font-bold mt-1">
              <MoneyAmount
                value={loanSchedule.monthlyScheduledPayment}
                currency={activeAccount.currency}
              />
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
            <div className="text-xs text-[var(--text-secondary)]">Payoff Horizon</div>
            <div className="text-lg font-bold font-mono-tabular mt-1">
              {loanSchedule.payoffMonths} months
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
            <div className="text-xs text-[var(--text-secondary)]">Months Saved</div>
            <div className="text-lg font-bold font-mono-tabular text-[var(--status-positive)] mt-1">
              {loanSchedule.monthsSaved} months
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
            <div className="text-xs text-[var(--text-secondary)]">Interest Saved</div>
            <div className="text-lg font-bold text-[var(--status-positive)] mt-1">
              <MoneyAmount value={loanSchedule.interestSaved} currency={activeAccount.currency} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-lg border border-[var(--border-primary)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Month</th>
                <th className="text-right px-3 py-2 font-medium">Principal</th>
                <th className="text-right px-3 py-2 font-medium">Interest</th>
                <th className="text-right px-3 py-2 font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {loanSchedule.schedule.slice(0, 24).map((row) => (
                <tr key={row.month}>
                  <td className="px-3 py-2 font-mono-tabular">#{row.month}</td>
                  <td className="px-3 py-2 text-right text-[var(--status-positive)]">
                    <MoneyAmount value={row.principalPaid} currency={activeAccount.currency} />
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--status-warning)]">
                    <MoneyAmount value={row.interestPaid} currency={activeAccount.currency} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    <MoneyAmount
                      value={row.remainingBalance}
                      currency={activeAccount.currency}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};
