import React, { useEffect, useMemo, useState } from 'react';
import {
  ImportFormat,
  RecurringCadence,
  RuleField,
  RuleOperator,
  absMoney,
  compareMoney,
} from '@sure/shared';
import {
  Alert,
  Button,
  Card,
  CategoryIcon,
  Dialog,
  IconPicker,
  MoneyAmount,
  Pill,
  Toggle,
} from '@sure/ui';
import {
  Archive,
  Check,
  GitBranch,
  Info,
  Link2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useLedger, WebTransferSuggestion } from '../../lib/ledger-context.js';

export type TransactionsSectionId =
  | 'categories'
  | 'tags'
  | 'rules'
  | 'merchants'
  | 'recurring'
  | 'auto_matches'
  | 'statement_vault';

const TAG_COLOR_SWATCHES = [
  '#f59e0b',
  '#078C52',
  '#3b82f6',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#f97316',
  '#38bdf8',
  '#6366f1',
  '#10b981',
];

interface VaultLocalFile {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface DetectedPattern {
  key: string;
  name: string;
  amount: string;
  currency: string;
  accountId: string;
  categoryId: string | null;
  count: number;
  latestDate: string;
  isIncome: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const TransactionsSettingsSections: React.FC<{
  activeSection: TransactionsSectionId;
  enableAutoMatch: boolean;
  onToggleAutoMatch: (enabled: boolean) => void;
  actionTriggerCounter?: { section: TransactionsSectionId; tick: number } | null;
}> = ({
  activeSection,
  enableAutoMatch,
  onToggleAutoMatch,
  actionTriggerCounter,
}) => {
  const {
    family,
    accounts,
    categories,
    tags,
    merchants,
    rules,
    entries,
    recurring,
    imports,
    createCategory,
    createTag,
    createMerchant,
    createRule,
    toggleRuleActive,
    deleteRule,
    dryRunRule,
    applyAllRules,
    createRecurringBill,
    markRecurringPaid,
    deleteRecurringBill,
    fetchTransferSuggestions,
    matchTransfer,
    previewImportFile,
  } = useLedger();

  // Category modal state
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catClass, setCatClass] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [catColor, setCatColor] = useState('#078C52');
  const [catIcon, setCatIcon] = useState('Tag');

  // Tag modal state
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#ef4444');

  // Merchant modal state
  const [newMerchantOpen, setNewMerchantOpen] = useState(false);
  const [merchantName, setMerchantName] = useState('');

  // Rules state
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

  // Recurring pattern dismissal & refresh tick
  const [dismissedPatterns, setDismissedPatterns] = useState<Record<string, boolean>>({});
  const [patternScanNotice, setPatternScanNotice] = useState<string | null>(null);

  // Auto Matches state
  const [suggestions, setSuggestions] = useState<WebTransferSuggestion[]>([]);
  const [dismissedMatchKeys, setDismissedMatchKeys] = useState<Record<string, boolean>>({});
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Statement Vault state
  const [vaultAccountId, setVaultAccountId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [unmatchedFiles, setUnmatchedFiles] = useState<VaultLocalFile[]>([]);
  const [vaultStatus, setVaultStatus] = useState<string | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);

  // Respond to parent header "+ New ..." action button clicks
  useEffect(() => {
    if (!actionTriggerCounter) return;
    if (actionTriggerCounter.section === 'categories') setNewCatOpen(true);
    if (actionTriggerCounter.section === 'tags') setNewTagOpen(true);
    if (actionTriggerCounter.section === 'merchants') setNewMerchantOpen(true);
    if (actionTriggerCounter.section === 'rules') setNewRuleOpen(true);
  }, [actionTriggerCounter]);

  const loadTransferSuggestions = async () => {
    setMatchesLoading(true);
    try {
      const items = await fetchTransferSuggestions();
      setSuggestions(items);
    } catch {
      setSuggestions([]);
    } finally {
      setMatchesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'auto_matches') {
      void loadTransferSuggestions();
    }
  }, [activeSection]);

  // Usage counts across entries
  const categoryUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.categoryId) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const tagUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const tid of e.tagIds) counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const merchantUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.merchantId) counts.set(e.merchantId, (counts.get(e.merchantId) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  // Detect recurring patterns dynamically from ledger entries
  const detectedPatterns = useMemo<DetectedPattern[]>(() => {
    const existingNames = new Set(recurring.map((r) => r.name.trim().toLowerCase()));
    const groups = new Map<string, DetectedPattern>();

    for (const e of entries) {
      if (e.entryType !== 'TRANSACTION') continue;
      const key = e.name.trim().toLowerCase();
      if (!key || existingNames.has(key)) continue;
      const cur = groups.get(key);
      if (!cur) {
        groups.set(key, {
          key,
          name: e.name.trim(),
          amount: absMoney(e.amount),
          currency: e.currency,
          accountId: e.accountId,
          categoryId: e.categoryId,
          count: 1,
          latestDate: e.date.slice(0, 10),
          isIncome: compareMoney(e.amount, '0') > 0,
        });
      } else {
        cur.count += 1;
        if (e.date.slice(0, 10) > cur.latestDate) {
          cur.latestDate = e.date.slice(0, 10);
          cur.amount = absMoney(e.amount);
        }
      }
    }

    return Array.from(groups.values())
      .filter((g) => g.count >= 2 && !dismissedPatterns[g.key])
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [entries, recurring, dismissedPatterns]);

  const visibleSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) => !dismissedMatchKeys[`${s.outflowEntryId}:${s.inflowEntryId}`]
      ),
    [suggestions, dismissedMatchKeys]
  );

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await createCategory(catName.trim(), catClass, catIcon, catColor);
    setCatName('');
    setNewCatOpen(false);
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    await createTag(tagName.trim());
    setTagName('');
    setNewTagOpen(false);
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName.trim()) return;
    await createMerchant(merchantName.trim());
    setMerchantName('');
    setNewMerchantOpen(false);
  };

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

  const handleUploadStatement = async () => {
    if (!selectedFile) return;
    setVaultBusy(true);
    setVaultStatus(null);
    try {
      const ext = selectedFile.name.split('.').pop()?.toUpperCase() ?? 'CSV';
      const format: ImportFormat =
        ext === 'QIF' ? 'QIF' : ext === 'OFX' || ext === 'QFX' ? 'OFX' : ext === 'PDF' ? 'PDF' : 'CSV';

      if (vaultAccountId && format !== 'PDF') {
        const text = await selectedFile.text();
        await previewImportFile({
          accountId: vaultAccountId,
          format,
          fileName: selectedFile.name,
          rawContent: text || `Date,Name,Amount\n${new Date().toISOString().slice(0, 10)},Statement Upload,0.00`,
        });
        setVaultStatus(`Uploaded & linked "${selectedFile.name}" (${format}) to account statements.`);
      } else {
        setUnmatchedFiles((prev) => [
          {
            id: `vault-${Date.now()}`,
            name: selectedFile.name,
            sizeBytes: selectedFile.size,
            uploadedAt: new Date().toISOString().slice(0, 10),
          },
          ...prev,
        ]);
        setVaultStatus(`Saved "${selectedFile.name}" to the unmatched statement inbox.`);
      }
      setSelectedFile(null);
    } catch (err) {
      setVaultStatus(err instanceof Error ? err.message : 'Failed to upload statement file.');
    } finally {
      setVaultBusy(false);
    }
  };

  const totalVaultBytes = unmatchedFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

  return (
    <div className="space-y-5">
      {/* 1. CATEGORIES (Sure Screenshot 1 & 2) */}
      {activeSection === 'categories' && (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            CATEGORIES <span className="mx-1">•</span> {categories.length}
          </div>

          {categories.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="text-sm text-[var(--text-secondary)]">No categories created yet.</div>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewCatOpen(true)}>
                New category
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)]">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)]/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Pill
                      label={cat.name}
                      color={cat.color}
                      icon={
                        <CategoryIcon
                          icon={cat.icon}
                          label={cat.name}
                          color={cat.color}
                          size="xs"
                        />
                      }
                      size="sm"
                    />
                    <span className="text-[11px] text-[var(--text-muted)] uppercase">
                      {cat.classification}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className="font-mono-tabular">
                      {categoryUsage.get(cat.id) ?? 0} entries
                    </span>
                    <MoreHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. TAGS (Sure Screenshot 3 & 4) */}
      {activeSection === 'tags' && (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            TAGS <span className="mx-1">•</span> {tags.length}
          </div>

          {tags.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="text-sm text-[var(--text-secondary)]">No tags created yet.</div>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewTagOpen(true)}>
                New tag
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)]">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)]/50"
                >
                  <span
                    style={{
                      backgroundColor: `${tag.color || '#10b981'}1A`,
                      color: tag.color || '#10b981',
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tag.color || '#10b981' }}
                    />
                    <span>{tag.name}</span>
                  </span>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className="font-mono-tabular">
                      {tagUsage.get(tag.id) ?? 0} entries
                    </span>
                    <MoreHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. RULES (Sure Screenshot 5) */}
      {activeSection === 'rules' && (
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
        </div>
      )}

      {/* 4. MERCHANTS (Sure Screenshot 6) */}
      {activeSection === 'merchants' && (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 space-y-6">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              FAMILY MERCHANTS <span className="mx-1">•</span> {merchants.length}
            </div>

            {merchants.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="text-sm text-[var(--text-secondary)]">No family merchants yet</div>
                <Button
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setNewMerchantOpen(true)}
                >
                  New merchant
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-primary)] divide-y divide-[var(--border-primary)] overflow-hidden">
                {merchants.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CategoryIcon
                        icon="Store"
                        label={m.name}
                        color={m.color || '#6366f1'}
                        variant="circle"
                        size="sm"
                      />
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {m.name}
                      </span>
                    </div>
                    <span className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                      {merchantUsage.get(m.id) ?? 0} transactions
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-[var(--border-primary)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              PROVIDER MERCHANTS
            </div>
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-secondary)]">
              <Info className="w-4 h-4 text-[var(--status-info)] shrink-0 mt-0.5" />
              <span>
                Merchants linked from bank connections or rules can be normalized here so reports and budgets group related charges consistently.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. RECURRING (Sure Screenshot 7) */}
      {activeSection === 'recurring' && (
        <div className="space-y-5">
          {patternScanNotice && (
            <Alert variant="info" title="Pattern Scan Complete">
              {patternScanNotice}
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-[var(--text-secondary)]">
              Manage detected recurring expenses and income schedules across your accounts.
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<Search className="w-3.5 h-3.5" />}
              onClick={() =>
                setPatternScanNotice(
                  `Scanned ${entries.length} ledger entries: found ${detectedPatterns.length} candidate repeating payee pattern(s) and ${recurring.length} active schedule(s).`
                )
              }
            >
              Identify Patterns
            </Button>
          </div>

          {/* Configured Recurring Items */}
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              CONFIGURED RECURRING <span className="mx-1">•</span> {recurring.length}
            </div>
            {recurring.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                No recurring bills or income schedules configured yet. Add one from the detected patterns below.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)]">
                {recurring.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{r.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        <MoneyAmount value={r.amount} currency={r.currency} /> • {r.cadence} • Next:{' '}
                        {r.nextOccurrenceDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void markRecurringPaid(r.id)}
                      >
                        Mark Paid
                      </Button>
                      <button
                        type="button"
                        aria-label={`Delete recurring ${r.name}`}
                        onClick={() => void deleteRecurringBill(r.id)}
                        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--status-negative)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Possible New Patterns Detected from Entries */}
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              POSSIBLE NEW PATTERNS <span className="mx-1">•</span> {detectedPatterns.length}
            </div>
            {detectedPatterns.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                No new repeating transaction patterns found in your current ledger.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)]">
                {detectedPatterns.map((p) => (
                  <div
                    key={p.key}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{p.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        <MoneyAmount value={p.amount} currency={p.currency} /> • Monthly • seen{' '}
                        {p.count} times
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          void createRecurringBill({
                            name: p.name,
                            amount: p.amount,
                            currency: p.currency,
                            cadence: 'MONTHLY' as RecurringCadence,
                            nextOccurrenceDate: p.latestDate,
                            accountId: p.accountId,
                            categoryId: p.categoryId,
                          })
                        }
                      >
                        {p.isIncome ? 'Add income' : 'Add bill'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDismissedPatterns((prev) => ({ ...prev, [p.key]: true }))
                        }
                      >
                        {p.isIncome ? 'Not income' : 'Not a bill'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. AUTO MATCHES (Sure Screenshot 8) */}
      {activeSection === 'auto_matches' && (
        <div className="space-y-5">
          <Card padding="sm">
            <div className="px-1">
              <Toggle
                checked={enableAutoMatch}
                onChange={onToggleAutoMatch}
                label="Enable Auto Match"
                description="Automatically detect and suggest transfer matches between accounts. Suggestions are not applied until confirmed below."
              />
            </div>
          </Card>

          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                AUTO MATCHES <span className="mx-1">•</span> {visibleSuggestions.length}
              </span>
              <button
                type="button"
                onClick={() => void loadTransferSuggestions()}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${matchesLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {visibleSuggestions.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Link2 className="w-5 h-5 text-[var(--text-muted)] mx-auto" />
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  No pending transfer matches
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Matching opposite-sign transfers across your accounts will appear here for confirmation.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">From</th>
                      <th className="text-left px-4 py-2.5 font-medium">To</th>
                      <th className="text-left px-4 py-2.5 font-medium">Date</th>
                      <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {visibleSuggestions.map((s) => {
                      const matchKey = `${s.outflowEntryId}:${s.inflowEntryId}`;
                      return (
                        <tr key={matchKey} className="hover:bg-[var(--bg-surface-hover)]/40">
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--text-primary)]">
                              {s.outflowName}
                            </div>
                            <div className="text-[var(--text-secondary)]">{s.outflowAccountName}</div>
                            <div className="font-mono-tabular text-[var(--text-secondary)]">
                              <MoneyAmount value={s.amount} currency={family.baseCurrency} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--text-primary)]">
                              {s.inflowName}
                            </div>
                            <div className="text-[var(--text-secondary)]">{s.inflowAccountName}</div>
                            <div className="font-mono-tabular text-[var(--text-secondary)]">
                              <MoneyAmount value={s.amount} currency={family.baseCurrency} />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono-tabular text-[var(--text-secondary)]">
                            {s.outflowDate.slice(0, 10)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label="Confirm match"
                                onClick={async () => {
                                  await matchTransfer(s.outflowEntryId, s.inflowEntryId);
                                  await loadTransferSuggestions();
                                }}
                                className="p-1.5 rounded-md text-[var(--status-positive)] hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Dismiss match"
                                onClick={() =>
                                  setDismissedMatchKeys((prev) => ({ ...prev, [matchKey]: true }))
                                }
                                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--status-negative)] hover:bg-red-500/10 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. STATEMENT VAULT (Sure Screenshot 9) */}
      {activeSection === 'statement_vault' && (
        <div className="space-y-5">
          {vaultStatus && (
            <Alert variant="info" title="Statement Vault">
              {vaultStatus}
            </Alert>
          )}

          <Card>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Upload statements
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Upload statements to the inbox, or choose an account to stage an import immediately.
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-[var(--text-secondary)]">Storage used</div>
                  <div className="text-xs font-semibold font-mono-tabular text-[var(--text-primary)]">
                    {formatBytes(totalVaultBytes)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6 rounded-lg border border-[var(--border-primary)] px-3 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1">
                    Statement files
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.csv,.ofx,.qfx,.qif,.xlsx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-[var(--text-secondary)] file:mr-2.5 file:py-1 file:px-2.5 file:rounded file:border file:border-[var(--border-strong)] file:text-xs file:font-medium file:bg-[var(--bg-surface-subtle)] file:text-[var(--text-primary)] cursor-pointer"
                  />
                </div>

                <div className="sm:col-span-4 rounded-lg border border-[var(--border-primary)] px-3 py-2 bg-[var(--bg-surface)]">
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">
                    Account
                  </label>
                  <select
                    value={vaultAccountId}
                    onChange={(e) => setVaultAccountId(e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="">Leave unmatched</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Button
                    className="w-full"
                    disabled={!selectedFile || vaultBusy}
                    icon={<Upload className="w-3.5 h-3.5" />}
                    onClick={() => void handleUploadStatement()}
                  >
                    Upload
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)]">
                PDF, CSV, QIF, or OFX supported. CSV/QIF/OFX statements selected with an account stage directly into your ledger imports.
              </p>
            </div>
          </Card>

          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              UNMATCHED INBOX <span className="mx-1">•</span> {unmatchedFiles.length}
            </div>
            {unmatchedFiles.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                The statement inbox is clear.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)]">
                {unmatchedFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Archive className="w-4 h-4 text-[var(--text-secondary)]" />
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">{f.name}</div>
                        <div className="text-[var(--text-secondary)]">
                          {formatBytes(f.sizeBytes)} • {f.uploadedAt}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setUnmatchedFiles((prev) => prev.filter((item) => item.id !== f.id))
                      }
                      className="text-[var(--status-negative)] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              LINKED STATEMENTS <span className="mx-1">•</span> {imports.length}
            </div>
            {imports.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                No linked statements yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)]">
                {imports.map((imp) => {
                  const acc = accounts.find((a) => a.id === imp.accountId);
                  return (
                    <div key={imp.id} className="flex items-center justify-between px-4 py-3 text-xs">
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">{imp.fileName}</div>
                        <div className="text-[var(--text-secondary)]">
                          {acc?.name ?? 'Account'} • {imp.format} • {imp.rowCount} rows
                        </div>
                      </div>
                      <Pill
                        label={imp.status}
                        color={imp.status === 'COMPLETED' ? '#078C52' : '#f59e0b'}
                        size="xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: New Category (Screenshot 2) */}
      <Dialog
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        title="New category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div className="flex justify-center py-1">
            <CategoryIcon
              icon={catIcon}
              label={catName || 'Category'}
              color={catColor}
              variant="circle"
              size="md"
            />
          </div>

          <div className="rounded-lg border border-[var(--border-strong)] px-3.5 py-2 bg-[var(--bg-surface)]">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
              Name <span className="text-[var(--status-negative)]">*</span>
            </label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category name"
              className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
              Classification
            </label>
            <select
              value={catClass}
              onChange={(e) => setCatClass(e.target.value as 'EXPENSE' | 'INCOME')}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </div>

          <IconPicker
            selectedColor={catColor}
            selectedIcon={catIcon}
            onChangeColor={setCatColor}
            onChangeIcon={setCatIcon}
          />

          <Button type="submit" className="w-full">
            Create Category
          </Button>
        </form>
      </Dialog>

      {/* MODAL: New Tag (Screenshot 4) */}
      <Dialog open={newTagOpen} onClose={() => setNewTagOpen(false)} title="New tag">
        <form onSubmit={handleCreateTag} className="space-y-4">
          <div className="flex justify-center py-1">
            <span
              style={{ backgroundColor: `${tagColor}1A`, color: tagColor }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagColor }} />
              <span>{tagName.trim() || '?'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {TAG_COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Select color ${swatch}`}
                onClick={() => setTagColor(swatch)}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                  tagColor === swatch ? 'ring-2 ring-offset-2 ring-[var(--accent-primary)] scale-110' : ''
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>

          <input
            type="text"
            required
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Tag name"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />

          <Button type="submit" className="w-full">
            Create Tag
          </Button>
        </form>
      </Dialog>

      {/* MODAL: New Merchant */}
      <Dialog
        open={newMerchantOpen}
        onClose={() => setNewMerchantOpen(false)}
        title="New merchant"
      >
        <form onSubmit={handleCreateMerchant} className="space-y-4">
          <div className="flex justify-center py-1">
            <span className="w-11 h-11 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)]">
              <Store className="w-5 h-5" />
            </span>
          </div>
          <input
            type="text"
            required
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            placeholder="Merchant name (e.g., Whole Foods Market)"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
          <Button type="submit" className="w-full">
            Create Merchant
          </Button>
        </form>
      </Dialog>

      {/* MODAL: New Automation Rule */}
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
