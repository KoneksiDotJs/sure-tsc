import React, { useCallback, useEffect, useState } from 'react';
import { LlmUsageReportDto } from '@sure/shared';
import { Alert, Button, Card, useLocale, usePrivacyMode } from '@sure/ui';
import { Activity, Bot, DollarSign, Hash, Info, Loader2, TrendingUp } from 'lucide-react';
import { apiRequest } from '../../../lib/api-client.js';

export const LlmUsageSection: React.FC = () => {
  const { bcp47, t } = useLocale();
  const { enabled: privacyEnabled } = usePrivacyMode();

  const [usageStartDate, setUsageStartDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [usageEndDate, setUsageEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appliedUsageRange, setAppliedUsageRange] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 30);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  });
  const [usageReport, setUsageReport] = useState<LlmUsageReportDto | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const fetchLlmUsage = useCallback(async (startDate: string, endDate: string) => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const qs = new URLSearchParams({ startDate, endDate, limit: '100' });
      const data = await apiRequest<LlmUsageReportDto>(`/api/v1/ai/usage?${qs.toString()}`);
      setUsageReport(data);
    } catch (err) {
      setUsageError(err instanceof Error ? err.message : 'Failed to load LLM usage telemetry');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLlmUsage(appliedUsageRange.startDate, appliedUsageRange.endDate);
  }, [appliedUsageRange.startDate, appliedUsageRange.endDate, fetchLlmUsage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUsageUpdated = () => {
      void fetchLlmUsage(appliedUsageRange.startDate, appliedUsageRange.endDate);
    };
    window.addEventListener('sure:ai-usage-updated', onUsageUpdated);
    return () => window.removeEventListener('sure:ai-usage-updated', onUsageUpdated);
  }, [appliedUsageRange.startDate, appliedUsageRange.endDate, fetchLlmUsage]);

  const summary = usageReport?.summary ?? {
    totalRequests: 0,
    requestsWithCostData: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUsd: '0.00',
    avgCostPerRequestUsd: '0.0000',
  };
  const events = usageReport?.events ?? [];
  const fmtCount = (n: number) => n.toLocaleString(bcp47);
  const fmtTimestamp = (iso: string) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString(bcp47 === 'id-ID' ? 'id-ID' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <div className="space-y-5">
        <div className="text-sm text-[var(--text-secondary)]">
          {t('llmUsage.subtitle')}
        </div>

        {/* Date Range Filter Row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedUsageRange({ startDate: usageStartDate, endDate: usageEndDate });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              {t('llmUsage.startDate')}
            </label>
            <input
              type="date"
              value={usageStartDate}
              onChange={(e) => setUsageStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              {t('llmUsage.endDate')}
            </label>
            <input
              type="date"
              value={usageEndDate}
              onChange={(e) => setUsageEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-primary)]"
            />
          </div>
          <Button type="submit" size="sm" disabled={usageLoading}>
            {usageLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('llmUsage.filter')}</span>
              </span>
            ) : (
              t('llmUsage.filter')
            )}
          </Button>
        </form>

        {usageError && (
          <Alert variant="error" title="Unable to load LLM usage">
            {usageError}
          </Alert>
        )}

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <Activity className="w-3.5 h-3.5" />
              <span>{t('llmUsage.totalRequests')}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)] mt-2">
              {fmtCount(summary.totalRequests)}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <Hash className="w-3.5 h-3.5" />
              <span>{t('llmUsage.totalTokens')}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)] mt-2">
              {fmtCount(summary.totalTokens)}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1 font-mono-tabular">
              {fmtCount(summary.totalPromptTokens)} prompt / {fmtCount(summary.totalCompletionTokens)} completion
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{t('llmUsage.totalCost')}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)] mt-2">
              {privacyEnabled ? '••••' : `$${summary.totalCostUsd}`}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{t('llmUsage.avgCostPerRequest')}</span>
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)] mt-2">
              {privacyEnabled ? '••••' : `$${summary.avgCostPerRequestUsd}`}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              Based on {summary.requestsWithCostData} of {summary.totalRequests} requests with cost data
            </div>
          </div>
        </div>

        {/* Recent Usage Table */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('llmUsage.recentUsage')}
          </h3>

          {events.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-primary)] py-8 px-4 text-center text-xs text-[var(--text-secondary)] space-y-1.5">
              <Bot className="w-5 h-5 text-[var(--text-muted)] mx-auto" />
              <div className="font-medium text-[var(--text-primary)]">{t('llmUsage.emptyTitle')}</div>
              <div>{t('llmUsage.emptyHint')}</div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]/50 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="py-2.5 px-4">{t('llmUsage.colDate')}</th>
                    <th className="py-2.5 px-4">{t('llmUsage.colOperation')}</th>
                    <th className="py-2.5 px-4">{t('llmUsage.colModel')}</th>
                    <th className="py-2.5 px-4 text-right">{t('llmUsage.colTokens')}</th>
                    <th className="py-2.5 px-4 text-right">{t('llmUsage.colCost')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)] text-xs">
                  {events.map((ev) => (
                    <tr
                      key={ev.id}
                      className="hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      <td className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                        {fmtTimestamp(ev.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {ev.operation}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-[var(--text-primary)]">
                        {ev.model}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular whitespace-nowrap">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {fmtCount(ev.totalTokens)}
                        </span>{' '}
                        <span className="text-[var(--text-muted)]">
                          ({fmtCount(ev.promptTokens)}/{fmtCount(ev.completionTokens)})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                        {ev.estimatedCostUsd !== null
                          ? privacyEnabled
                            ? '••••'
                            : `$${ev.estimatedCostUsd}`
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* About Cost Estimates Info Banner */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3.5 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-[var(--text-primary)]">
              {t('llmUsage.aboutTitle')}
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {t('llmUsage.aboutBody')}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
