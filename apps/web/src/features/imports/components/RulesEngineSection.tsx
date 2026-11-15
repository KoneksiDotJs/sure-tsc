import React, { useState } from 'react';
import type { RuleField, RuleOperator } from '@sure/shared';
import { Alert, Button, Card, CategorySelect, Dialog, MoneyAmount, Pill, Section } from '@sure/ui';
import { Eye, Play, Trash2 } from 'lucide-react';
import type { LedgerContextValue, WebCategory, WebRule } from '../../../lib/ledger-context.js';

interface RulesEngineSectionProps {
  baseCurrency: string;
  categories: WebCategory[];
  rules: WebRule[];
  onCreateRule: LedgerContextValue['createRule'];
  onToggleRuleActive: (id: string, isActive: boolean) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onDryRunRule: LedgerContextValue['dryRunRule'];
  onApplyAllRules: () => Promise<number>;
}

export const RulesEngineSection: React.FC<RulesEngineSectionProps> = ({
  baseCurrency,
  categories,
  rules,
  onCreateRule,
  onToggleRuleActive,
  onDeleteRule,
  onDryRunRule,
  onApplyAllRules,
}) => {
  const [ruleName, setRuleName] = useState('');
  const [condField, setCondField] = useState<RuleField>('name');
  const [condOp, setCondOp] = useState<RuleOperator>('contains');
  const [condValue, setCondValue] = useState('APPLE');
  const [actionCatId, setActionCatId] = useState<string | null>(null);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{
    totalEvaluated: number;
    matchCount: number;
    matches: Array<{ id: string; date: string; name: string; amount: string; proposedName: string }>;
  } | null>(null);
  const [appliedBannerCount, setAppliedBannerCount] = useState<number | null>(null);

  const effectiveActionCatId = categories.some((c) => c.id === actionCatId)
    ? actionCatId
    : (categories[0]?.id ?? null);

  const handleDryRun = async () => {
    const res = await onDryRunRule({
      matchMode: 'ALL',
      conditions: [{ field: condField, operator: condOp, value: condValue }],
      actions: { setCategoryId: effectiveActionCatId ?? undefined },
    });
    setDryRunResult(res);
    setDryRunOpen(true);
  };

  return (
    <>
      <Section
        title="Automated Rule Engine & Dry-Run Preview (FR-3.2)"
        description="Evaluate merchant, name, notes, and Decimal amount conditions to categorize, rename, or exclude entries"
        action={
          <Button
            size="sm"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={async () => {
              const count = await onApplyAllRules();
              setAppliedBannerCount(count);
            }}
          >
            Run Active Rules Now
          </Button>
        }
      >
        {appliedBannerCount !== null && (
          <Alert variant="success" title="Rule Batch Execution Completed">
            Evaluated active rules across historical ledger entries ({appliedBannerCount} rule matches applied).
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Create Automation Rule">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Categorize Cloud & SaaS Vendors"
                  className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Field
                  </label>
                  <select
                    value={condField}
                    onChange={(e) => setCondField(e.target.value as RuleField)}
                    className="w-full px-2 py-2 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  >
                    <option value="name">name</option>
                    <option value="merchant">merchant</option>
                    <option value="notes">notes</option>
                    <option value="amount">amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Operator
                  </label>
                  <select
                    value={condOp}
                    onChange={(e) => setCondOp(e.target.value as RuleOperator)}
                    className="w-full px-2 py-2 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  >
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="starts_with">starts_with</option>
                    <option value="gt">gt (&gt;)</option>
                    <option value="lt">lt (&lt;)</option>
                    <option value="between">between</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Match Value
                  </label>
                  <input
                    type="text"
                    value={condValue}
                    onChange={(e) => setCondValue(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                </div>
              </div>

              <CategorySelect
                label="Action: Assign Category"
                options={categories}
                value={effectiveActionCatId}
                onChange={setActionCatId}
              />

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Eye className="w-3.5 h-3.5" />}
                  onClick={() => void handleDryRun()}
                >
                  Dry-Run Preview
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!ruleName.trim()) return;
                    void onCreateRule({
                      name: ruleName.trim(),
                      groupName: 'Custom Rules',
                      priority: 50,
                      matchMode: 'ALL',
                      isActive: true,
                      conditions: [{ field: condField, operator: condOp, value: condValue }],
                      actions: { setCategoryId: effectiveActionCatId ?? undefined },
                    });
                    setRuleName('');
                  }}
                >
                  Save Rule
                </Button>
              </div>
            </div>
          </Card>

          <Card title={`Active Rules (${rules.length})`}>
            <div className="divide-y divide-[var(--border-primary)]">
              {rules.map((r) => (
                <div key={r.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold truncate">{r.name}</span>
                      <Pill label={`Priority ${r.priority}`} color="#3b82f6" />
                      <Pill
                        label={r.isActive ? 'Active' : 'Paused'}
                        color={r.isActive ? '#10b981' : '#64748b'}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void onToggleRuleActive(r.id, !r.isActive)}
                      >
                        {r.isActive ? 'Pause' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete rule ${r.name}`}
                        icon={<Trash2 className="w-3.5 h-3.5 text-[var(--status-negative)]" />}
                        onClick={() => void onDeleteRule(r.id)}
                      />
                    </div>
                  </div>
                  <div className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                    IF {r.conditions.map((c) => `${c.field} ${c.operator} "${c.value}"`).join(' AND ')}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Dialog
        open={dryRunOpen}
        onClose={() => setDryRunOpen(false)}
        title="Rule Dry-Run Preview"
        description={
          dryRunResult
            ? `Matched ${dryRunResult.matchCount} of ${dryRunResult.totalEvaluated} historical entries`
            : 'Evaluating rules on server...'
        }
      >
        <div className="divide-y divide-[var(--border-primary)]">
          {dryRunResult?.matches.length === 0 && (
            <div className="py-6 text-center text-sm text-[var(--text-secondary)]">
              No existing transactions matched this condition.
            </div>
          )}
          {dryRunResult?.matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <div className="font-medium">
                  {m.name}
                  {m.proposedName !== m.name && (
                    <span className="ml-2 text-xs text-[var(--status-info)]">
                      → {m.proposedName}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                  {m.date}
                </div>
              </div>
              <MoneyAmount value={m.amount} currency={baseCurrency} />
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
};
