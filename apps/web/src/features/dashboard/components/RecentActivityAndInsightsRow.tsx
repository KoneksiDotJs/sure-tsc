import React from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Layers,
  Lock,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { Button, Card, CategoryIcon, MoneyAmount, Pill, Section } from '@sure/ui';
import type { WebAccount, WebCategory, WebEntry, WebInsight } from '../../../lib/ledger-context.js';

interface RecentActivityAndInsightsRowProps {
  baseCurrency: string;
  entries: WebEntry[];
  categories: WebCategory[];
  accounts: WebAccount[];
  insights: WebInsight[];
  onNavigate: (tab: string) => void;
}

export const RecentActivityAndInsightsRow: React.FC<RecentActivityAndInsightsRowProps> = ({
  baseCurrency,
  entries,
  categories,
  accounts,
  insights,
  onNavigate,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
    <Section
      title="Recent Ledger Activity"
      description="Transactions, Valuations & Security Trades"
      action={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onNavigate('transactions')}
          icon={<Layers className="w-3.5 h-3.5" />}
        >
          Open Ledger
        </Button>
      }
    >
      <Card padding="none">
        <div className="divide-y divide-[var(--border-primary)]">
          {entries.slice(0, 6).map((entry) => {
            const cat = categories.find((c) => c.id === entry.categoryId);
            const acc = accounts.find((a) => a.id === entry.accountId);
            return (
              <div
                key={entry.id}
                onClick={() => onNavigate('transactions')}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] shrink-0">
                    {(entry.name[0] ?? 'T').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {entry.name}
                      </span>
                      {entry.entryType === 'TRANSACTION' && !entry.transferMatchId && cat && (
                        <Pill
                          label={cat.name}
                          color={cat.color}
                          icon={
                            <CategoryIcon
                              icon={cat.icon}
                              label={cat.name}
                              color={cat.color}
                              variant="inline"
                              size="xs"
                            />
                          }
                          size="xs"
                        />
                      )}
                      {entry.transferMatchId && (
                        <Pill
                          label="Transfer"
                          color="#3b82f6"
                          icon={<ArrowLeftRight className="w-3 h-3" />}
                          size="xs"
                        />
                      )}
                      {entry.entryType === 'TRADE' && (
                        <Pill
                          label="TRADE"
                          color="#078C52"
                          icon={<TrendingUp className="w-3 h-3" />}
                          size="xs"
                        />
                      )}
                      {entry.entryType === 'VALUATION' && (
                        <Pill
                          label="VALUATION"
                          color="#8b5cf6"
                          icon={<Scale className="w-3 h-3" />}
                          size="xs"
                        />
                      )}
                    </div>
                    <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5 truncate">
                      {entry.date} • {acc?.name ?? entry.accountId}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm font-semibold shrink-0">
                  {(entry.importId || entry.transferMatchId) && (
                    <Lock className="w-3 h-3 text-[var(--text-muted)]" />
                  )}
                  <MoneyAmount
                    value={entry.amount}
                    currency={entry.currency}
                    colorize={entry.entryType === 'TRANSACTION'}
                    showSign={entry.entryType === 'TRANSACTION'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </Section>

    <Section
      title="Proactive Insights"
      description="Background anomaly detection & cash-flow checks"
      action={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onNavigate('reports')}
          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
        >
          View Reports
        </Button>
      }
    >
      <Card padding="none">
        {insights.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
            No cash-flow anomalies or alerts detected.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {insights.map((ins) => {
              const statusColor =
                ins.severity === 'POSITIVE'
                  ? '#078C52'
                  : ins.severity === 'WARNING'
                  ? '#f59e0b'
                  : '#3b82f6';
              const StatusIcon =
                ins.severity === 'POSITIVE'
                  ? CheckCircle2
                  : ins.severity === 'WARNING'
                  ? AlertTriangle
                  : Info;
              return (
                <div key={ins.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${statusColor}1A`,
                        color: statusColor,
                      }}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {ins.title}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {ins.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-mono-tabular font-semibold text-[var(--text-primary)] shrink-0 pt-0.5">
                    <MoneyAmount value={ins.metricAmount} currency={baseCurrency} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Section>
  </div>
);
