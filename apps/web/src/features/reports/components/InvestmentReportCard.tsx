import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  Briefcase,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CategoryIcon, MoneyAmount } from '@sure/ui';

export interface InvestmentHoldingSummary {
  id: string;
  ticker: string;
  securityName: string;
  weightPct: string;
  marketValue: string;
  currency: string;
  returnPercent: string;
}

export interface InvestmentAccountSummary {
  id: string;
  name: string;
  accountType: string;
  icon?: string | null;
  color: string;
  balance: string;
  currency: string;
}

export interface InvestmentPerfSummary {
  portfolioValue: string;
  unrealized: string;
  totalReturnPct: string;
  realizedGains: string;
  contributions: string;
  withdrawals: string;
  topHoldings: InvestmentHoldingSummary[];
}

interface InvestmentReportCardProps {
  open: boolean;
  onToggleOpen: () => void;
  baseCurrency: string;
  investmentAccounts: InvestmentAccountSummary[];
  investmentPerf: InvestmentPerfSummary;
  showHoldingDetails: boolean;
  onToggleHoldingDetails: () => void;
}

export const InvestmentReportCard: React.FC<InvestmentReportCardProps> = ({
  open,
  onToggleOpen,
  baseCurrency,
  investmentAccounts,
  investmentPerf,
  showHoldingDetails,
  onToggleHoldingDetails,
}) => (
  <Card padding="none">
    <button
      type="button"
      onClick={onToggleOpen}
      className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer"
    >
      <div className="flex items-center gap-2">
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Investment Performance
        </span>
      </div>
      <span className="text-xs text-[var(--text-secondary)]">
        {investmentAccounts.length} investment accounts
      </span>
    </button>

    {open && (
      <div className="px-5 pb-5 pt-3 border-t border-[var(--border-primary)] space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Portfolio Value</span>
            </div>
            <div className="mt-2 text-lg font-semibold font-mono-tabular">
              <MoneyAmount value={investmentPerf.portfolioValue} currency={baseCurrency} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Total Return</span>
            </div>
            <div className="mt-2 text-lg font-semibold font-mono-tabular">
              <MoneyAmount
                value={investmentPerf.unrealized}
                currency={baseCurrency}
                colorize
                showSign
              />
            </div>
            <div
              className={`text-xs font-mono-tabular ${
                Number(investmentPerf.totalReturnPct) >= 0
                  ? 'text-[var(--status-positive)]'
                  : 'text-[var(--status-negative)]'
              }`}
            >
              ({investmentPerf.totalReturnPct}%)
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Dividend &amp; Realized</span>
            </div>
            <div className="mt-2 text-lg font-semibold font-mono-tabular">
              <MoneyAmount
                value={investmentPerf.realizedGains}
                currency={baseCurrency}
                colorize
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Period Contributions</span>
            </div>
            <div className="mt-2 text-lg font-semibold font-mono-tabular">
              <MoneyAmount value={investmentPerf.contributions} currency={baseCurrency} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Period Withdrawals</span>
            </div>
            <div className="mt-2 text-lg font-semibold font-mono-tabular">
              <MoneyAmount value={investmentPerf.withdrawals} currency={baseCurrency} />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
            Top Holdings
          </div>
          <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
              <div className="col-span-6">Holding</div>
              <div className="col-span-2 text-right">Weight</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2 text-right">Return</div>
            </div>
            {investmentPerf.topHoldings.length === 0 ? (
              <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                No active security holdings recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)]">
                {(showHoldingDetails
                  ? investmentPerf.topHoldings
                  : investmentPerf.topHoldings.slice(0, 5)
                ).map((h) => (
                  <div
                    key={h.id}
                    className="grid grid-cols-12 items-center px-4 py-2.5 text-xs bg-[var(--bg-surface)]"
                  >
                    <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center font-mono-tabular text-[10px] font-bold shrink-0">
                        {h.ticker.slice(0, 4)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--text-primary)] truncate">
                          {h.ticker}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          {h.securityName}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right font-mono-tabular text-[var(--text-secondary)]">
                      {h.weightPct}%
                    </div>
                    <div className="col-span-2 text-right font-mono-tabular font-semibold">
                      <MoneyAmount value={h.marketValue} currency={h.currency} />
                    </div>
                    <div
                      className={`col-span-2 text-right font-mono-tabular font-medium ${
                        Number(h.returnPercent) >= 0
                          ? 'text-[var(--status-positive)]'
                          : 'text-[var(--status-negative)]'
                      }`}
                    >
                      {Number(h.returnPercent) >= 0 ? '+' : ''}
                      {Number(h.returnPercent).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-[var(--text-primary)]">
            <span>Taxable</span>
            <MoneyAmount value={investmentPerf.unrealized} currency={baseCurrency} />
          </div>
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Unrealized Gains</span>
            <MoneyAmount value={investmentPerf.unrealized} currency={baseCurrency} />
          </div>
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Realized Gains</span>
            <MoneyAmount value={investmentPerf.realizedGains} currency={baseCurrency} />
          </div>
          <button
            type="button"
            onClick={onToggleHoldingDetails}
            className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 pt-1 cursor-pointer"
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${
                showHoldingDetails ? 'rotate-90' : ''
              }`}
            />
            <span>View details ({investmentPerf.topHoldings.length} holdings)</span>
          </button>
        </div>

        <div>
          <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
            Investment Accounts
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {investmentAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CategoryIcon
                    icon={acc.icon || (acc.accountType === 'CRYPTO' ? 'Coins' : 'TrendingUp')}
                    label={acc.name}
                    color={acc.color}
                    variant="circle"
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] capitalize">
                      {acc.accountType.toLowerCase()}
                    </div>
                  </div>
                </div>
                <MoneyAmount
                  value={acc.balance}
                  currency={acc.currency}
                  className="text-xs font-bold shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </Card>
);
