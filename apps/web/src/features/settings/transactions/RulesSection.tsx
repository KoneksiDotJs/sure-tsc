import React, { useEffect, useState } from 'react';
import { RuleField, RuleOperator } from '@sure/shared';
import { Alert, Button, Card, Dialog, Pill, Toggle } from '@sure/ui';
import { GitBranch, Play, Plus, Trash2 } from 'lucide-react';
import { useLedger } from '../../../lib/ledger-context.js';

export const RulesSection: React.FC<{
  actionTriggerCounter?: { section: string; tick: number } | null;
}> = ({ actionTriggerCounter }) => {
  const {
    categories,
    merchants,
    rules,
    entries,
    createRule,
    toggleRuleActive,
    deleteRule,
    dryRunRule,
    applyAllRules,
  } = useLedger();

  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleField, setRuleField] = useState<RuleField>('name');
  const [ruleOp, setRuleOp] = useState<RuleOperator>('contains');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleActionCatId, setRuleActionCatId] = useState('');
  const [ruleActionMerchantId, setRuleActionMerchantId] = useState('');
  const [ruleRunStatus, setRuleRunStatus] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{
    totalEvaluated: number;
    matchCount: number;
  } | null>(null);

  useEffect(() => {
    if (actionTriggerCounter?.section === 'rules') {
      setNewRuleOpen(true);
    }
  }, [actionTriggerCounter]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleValue.trim()) return;
    await createRule({
      name: ruleName.trim(),
      groupName: 'Custom Rules',
      priority: (rules.length + 1) * 10,
      matchMode: 'ALL',
      isActive: true,
      conditions: [{ field: ruleField, operator: ruleOp, value: ruleValue.trim() }],
      actions: {
        ...(ruleActionCatId ? { setCategoryId: ruleActionCatId } : {}),
        ...(ruleActionMerchantId ? { setMerchantId: ruleActionMerchantId } : {}),
      },
    });
    setRuleName('');
    setRuleValue('');
    setRuleActionCatId('');
    setRuleActionMerchantId('');
    setDryRunResult(null);
    setNewRuleOpen(false);
  };

  const handleApplyAllRules = async () => {
    const modified = await applyAllRules();
    setRuleRunStatus(`Executed ${rules.length} rule(s) across family ledger (${modified} entries updated).`);
  };

  return (
    <div className="space-y-5">
      {ruleRunStatus && (
        <Alert variant="success" title="Rule Engine Applied">
          {ruleRunStatus}
        </Alert>
      )}

      <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              RULES <span className="mx-1">•</span> {rules.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Play className="w-3.5 h-3.5" />}
                onClick={() => void handleApplyAllRules()}
              >
                Apply All
              </Button>
              <Button
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setNewRuleOpen(true)}
              >
                New rule
              </Button>
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Rules run from top to bottom. Once a rule sets a field on a transaction, rules further down do not overwrite that field.
          </p>
        </div>

        {rules.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="text-sm text-[var(--text-secondary)]">No automation rules configured yet.</div>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewRuleOpen(true)}>
              New rule
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {rules.map((rule) => {
              const cat = categories.find((c) => c.id === rule.actions.setCategoryId);
              const merch = merchants.find((m) => m.id === rule.actions.setMerchantId);
              const actionSummary = [
                cat ? `Categorize as ${cat.name}` : null,
                merch ? `Set merchant to ${merch.name}` : null,
                rule.actions.addTagIds?.length ? `Add ${rule.actions.addTagIds.length} tag(s)` : null,
                rule.actions.setExcluded ? 'Exclude from cash flow' : null,
              ]
                .filter(Boolean)
                .join(' • ') || 'Apply automation action';

              const condSummary =
                rule.conditions
                  .map((c) => `${c.field} ${c.operator} "${c.value}"`)
                  .join(` ${rule.matchMode} `) || 'All matching entries';

              return (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 hover:bg-[var(--bg-surface-hover)]/40"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <GitBranch className="w-4 h-4 text-[var(--text-muted)] mt-1 shrink-0" />
                    <div className="space-y-1.5 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {rule.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] w-9">
                          THEN
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]">
                          {actionSummary}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] w-9">
                          FOR
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
                          {condSummary}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Toggle
                      checked={rule.isActive}
                      onChange={(active) => void toggleRuleActive(rule.id, active)}
                    />
                    <button
                      type="button"
                      aria-label={`Delete rule ${rule.name}`}
                      onClick={() => void deleteRule(rule.id)}
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--status-negative)] hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Card title="Recent Runs" subtitle="Rule priority ordering and active status across your family ledger">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Priority</th>
                <th className="text-left px-3 py-2 font-medium">Rule Name</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Ledger Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 font-mono-tabular text-[var(--text-secondary)]">
                    #{r.priority}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">{r.name}</td>
                  <td className="px-3 py-2.5">
                    <Pill
                      label={r.isActive ? 'Active' : 'Paused'}
                      color={r.isActive ? '#078C52' : '#64748b'}
                      size="xs"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-tabular text-[var(--text-secondary)]">
                    {entries.length} entries
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={newRuleOpen}
        onClose={() => setNewRuleOpen(false)}
        title="New rule"
        description="Automatically categorize, tag, or clean matching transactions."
      >
        <form onSubmit={handleCreateRule} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Rule Name
            </label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Coffee & Dining Classifier"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Field
              </label>
              <select
                value={ruleField}
                onChange={(e) => setRuleField(e.target.value as RuleField)}
                className="w-full px-2.5 py-2 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="name">Name</option>
                <option value="merchant">Merchant</option>
                <option value="notes">Notes</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Operator
              </label>
              <select
                value={ruleOp}
                onChange={(e) => setRuleOp(e.target.value as RuleOperator)}
                className="w-full px-2.5 py-2 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="starts_with">Starts with</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Match Value
              </label>
              <input
                type="text"
                required
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                placeholder="e.g., STARBUCKS"
                className="w-full px-2.5 py-2 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Assign Category
              </label>
              <select
                value={ruleActionCatId}
                onChange={(e) => setRuleActionCatId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="">No category change</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Assign Merchant
              </label>
              <select
                value={ruleActionMerchantId}
                onChange={(e) => setRuleActionMerchantId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              >
                <option value="">No merchant change</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {dryRunResult && (
            <div className="p-2.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
              Dry run matched <strong className="text-[var(--text-primary)]">{dryRunResult.matchCount}</strong> of{' '}
              {dryRunResult.totalEvaluated} historical entries.
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (!ruleValue.trim()) return;
                const res = await dryRunRule({
                  matchMode: 'ALL',
                  conditions: [{ field: ruleField, operator: ruleOp, value: ruleValue.trim() }],
                  actions: {
                    ...(ruleActionCatId ? { setCategoryId: ruleActionCatId } : {}),
                    ...(ruleActionMerchantId ? { setMerchantId: ruleActionMerchantId } : {}),
                  },
                });
                setDryRunResult({
                  totalEvaluated: res.totalEvaluated,
                  matchCount: res.matchCount,
                });
              }}
            >
              Dry Run
            </Button>
            <Button type="submit" size="sm">
              Create Rule
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
