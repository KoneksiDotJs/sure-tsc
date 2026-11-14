import React, { useMemo, useState } from 'react';
import { ImportFormat, RuleField, RuleOperator } from '@sure/shared';
import {
  Card,
  Section,
  Button,
  Pill,
  MoneyAmount,
  SegmentedControl,
  CategorySelect,
  Dialog,
  Alert,
} from '@sure/ui';
import { useLedger } from '../../lib/ledger-context.js';
import { Upload, RotateCcw, Play, Eye, CheckCircle2, Trash2, FileUp } from 'lucide-react';

const SAMPLE_CSV = `date,description,amount
2026-11-13,STARBUCKS RESERVE ROASTERY,-18.75
2026-11-13,VERCEL PRO HOSTING,-20.00
2026-11-14,CLIENT CONSULTING RETAINER,3500.00`;

interface StagedRow {
  date: string;
  name: string;
  amount: string;
  duplicateWarning: boolean;
  skip: boolean;
}

export const ImportsAndRulesView: React.FC = () => {
  const {
    family,
    accounts,
    categories,
    imports,
    rules,
    previewImportFile,
    commitStagedImport,
    revertImportBatch,
    createRule,
    toggleRuleActive,
    deleteRule,
    dryRunRule,
    applyAllRules,
  } = useLedger();

  // 4-Step Import Wizard state (FR-3.1)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [format, setFormat] = useState<ImportFormat>('CSV');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [fileName, setFileName] = useState('statement_nov_2026.csv');
  const [rawContent, setRawContent] = useState(SAMPLE_CSV);
  const [dateColumn, setDateColumn] = useState('date');
  const [nameColumn, setNameColumn] = useState('description');
  const [amountColumn, setAmountColumn] = useState('amount');
  const [invertSign, setInvertSign] = useState(false);
  const [stagedImportId, setStagedImportId] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<StagedRow[]>([]);
  const [importBusy, setImportBusy] = useState(false);

  // Rule Engine state (FR-3.2)
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

  const effectiveAccountId = accounts.some((a) => a.id === accountId)
    ? accountId
    : (accounts[0]?.id ?? '');
  const effectiveActionCatId = categories.some((c) => c.id === actionCatId)
    ? actionCatId
    : (categories[0]?.id ?? null);

  const csvHeaders = useMemo(() => {
    const firstLine = rawContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    if (!firstLine) return ['date', 'description', 'amount'];
    return firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
  }, [rawContent]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setRawContent(text);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.ofx') || lower.endsWith('.qfx')) {
      setFormat('OFX');
    } else if (lower.endsWith('.qif')) {
      setFormat('QIF');
    } else if (lower.endsWith('.csv')) {
      setFormat('CSV');
    }
  };

  const handleGoToStep2 = () => {
    if (format === 'CSV' && csvHeaders.length > 0) {
      const findCol = (candidates: string[], fallback: string) =>
        csvHeaders.find((h) => candidates.some((c) => h.toLowerCase().includes(c))) ??
        fallback;
      setDateColumn(findCol(['date', 'posted', 'time'], csvHeaders[0] ?? 'date'));
      setNameColumn(findCol(['desc', 'name', 'merchant', 'payee', 'memo'], csvHeaders[1] ?? csvHeaders[0] ?? 'description'));
      setAmountColumn(findCol(['amount', 'amt', 'value', 'total'], csvHeaders[2] ?? csvHeaders[0] ?? 'amount'));
    }
    setStep(2);
  };

  const handlePreviewServer = async () => {
    if (!effectiveAccountId) return;
    setImportBusy(true);
    try {
      const res = await previewImportFile({
        accountId: effectiveAccountId,
        format,
        fileName,
        rawContent,
        columnMapping:
          format === 'CSV'
            ? { dateColumn, nameColumn, amountColumn, invertSign }
            : undefined,
      });
      setStagedImportId(res.importBatch.id);
      setParsedPreview(
        res.previewRows.map((r) => ({
          ...r,
          skip: r.duplicateWarning,
        }))
      );
      setStep(3);
    } finally {
      setImportBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!stagedImportId) return;
    setImportBusy(true);
    try {
      await commitStagedImport({
        importId: stagedImportId,
        rows: parsedPreview,
      });
      setStep(4);
    } finally {
      setImportBusy(false);
    }
  };

  const handleDryRun = async () => {
    const res = await dryRunRule({
      matchMode: 'ALL',
      conditions: [{ field: condField, operator: condOp, value: condValue }],
      actions: { setCategoryId: effectiveActionCatId ?? undefined },
    });
    setDryRunResult(res);
    setDryRunOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* FR-3.1 Guided 4-Step Import Wizard */}
      <Section
        title="Multi-Format Importer Wizard (CSV, QIF, OFX, PDF Statements)"
        description="FR-3.1 Guided 4-step workflow: Upload → Column Mapping → Clean/Preflight Review → Confirm + RevertImport"
      >
        <Card>
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--border-primary)]">
            {[
              { num: 1, label: '1. Upload Source' },
              { num: 2, label: '2. Column Mapping' },
              { num: 3, label: '3. Preflight Review' },
              { num: 4, label: '4. Committed' },
            ].map((s) => (
              <div
                key={s.num}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  step === s.num
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]'
                    : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {s.label}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] mr-1">
                  Quick Source Presets:
                </span>
                {[
                  { label: 'Generic CSV', file: 'statement.csv', icon: '/images/icon-csv.svg' },
                  { label: 'Mint Migration', file: 'mint_transactions.csv', icon: '/images/mint-logo.jpeg' },
                  { label: 'Monarch CSV', file: 'monarch_transactions.csv', icon: '/images/monarch-logo.png' },
                  { label: 'YNAB Register', file: 'ynab_register.csv', icon: '/images/ynab-logo.png' },
                ].map((src) => (
                  <button
                    key={src.label}
                    type="button"
                    onClick={() => {
                      setFormat('CSV');
                      setFileName(src.file);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                  >
                    <img src={src.icon} alt="" className="w-4 h-4 rounded-xs object-cover" />
                    <span>{src.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Statement Format
                  </label>
                  <SegmentedControl<ImportFormat>
                    options={[
                      { value: 'CSV', label: 'CSV' },
                      { value: 'QIF', label: 'QIF' },
                      { value: 'OFX', label: 'OFX / QFX' },
                      { value: 'PDF', label: 'PDF' },
                    ]}
                    value={format}
                    onChange={setFormat}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Destination Account
                  </label>
                  <select
                    value={effectiveAccountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    File Name
                  </label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-dashed border-[var(--border-strong)]">
                <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
                  <FileUp className="w-4 h-4 text-[var(--status-info)]" />
                  <span>Upload a `.csv`, `.qif`, `.ofx`, or `.qfx` statement file, or paste raw text below.</span>
                </div>
                <input
                  type="file"
                  accept=".csv,.qif,.ofx,.qfx,.txt"
                  onChange={(e) => void handleFileUpload(e)}
                  className="text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent-primary)] file:text-[var(--accent-primary-fg)] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Raw Statement Content ({format})
                </label>
                <textarea
                  rows={5}
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  className="w-full p-3 text-xs font-mono-tabular rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-strong)]"
                />
              </div>

              <Button icon={<Upload className="w-4 h-4" />} onClick={handleGoToStep2}>
                Continue to Column Mapping →
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {format === 'CSV' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                      <label className="block font-semibold mb-1.5">Date Column → Entry.date</label>
                      <select
                        value={dateColumn}
                        onChange={(e) => setDateColumn(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-strong)] font-mono-tabular"
                      >
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                      <label className="block font-semibold mb-1.5">Payee / Memo → Entry.name</label>
                      <select
                        value={nameColumn}
                        onChange={(e) => setNameColumn(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-strong)] font-mono-tabular"
                      >
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)]">
                      <label className="block font-semibold mb-1.5">Amount → DECIMAL(19,4)</label>
                      <select
                        value={amountColumn}
                        onChange={(e) => setAmountColumn(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-strong)] font-mono-tabular"
                      >
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invertSign}
                      onChange={(e) => setInvertSign(e.target.checked)}
                    />
                    Invert amount sign (e.g. credit card CSVs where charges are positive)
                  </label>
                </>
              ) : (
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
                  Using structured <span className="font-semibold text-[var(--text-primary)]">{format}</span> parser (`&lt;STMTTRN&gt;` / tag records). Server preflight will normalize dates, payees, and `DECIMAL(19,4)` amounts automatically.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button onClick={() => void handlePreviewServer()} disabled={importBusy}>
                  {importBusy ? 'Parsing on Server...' : 'Run Preflight Review →'}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-xs text-[var(--text-secondary)]">
                Parsed {parsedPreview.length} rows on server. Uncheck any duplicate or unwanted row to skip committing it.
              </div>
              <div className="divide-y divide-[var(--border-primary)] border border-[var(--border-primary)] rounded-lg">
                {parsedPreview.map((row, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                      row.skip ? 'opacity-50 bg-[var(--bg-surface-subtle)]' : ''
                    }`}
                  >
                    <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!row.skip}
                        onChange={(e) => {
                          const next = [...parsedPreview];
                          next[idx] = { ...row, skip: !e.target.checked };
                          setParsedPreview(next);
                        }}
                      />
                      <span className="font-mono-tabular text-xs text-[var(--text-secondary)] shrink-0">
                        {row.date}
                      </span>
                      <span className="font-medium truncate">{row.name}</span>
                      {row.duplicateWarning && (
                        <Pill label="Possible Duplicate" color="#f59e0b" />
                      )}
                    </label>
                    <MoneyAmount
                      value={row.amount}
                      currency={
                        accounts.find((a) => a.id === effectiveAccountId)?.currency ??
                        family.baseCurrency
                      }
                      colorize
                      showSign
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  ← Back
                </Button>
                <Button
                  onClick={() => void handleConfirmImport()}
                  disabled={importBusy || parsedPreview.filter((r) => !r.skip).length === 0}
                >
                  {importBusy
                    ? 'Committing...'
                    : `Confirm & Commit ${parsedPreview.filter((r) => !r.skip).length} Entries to Ledger`}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--status-positive-bg)] border border-[var(--status-positive)]">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--status-positive)]">
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  Import committed and daily account_balances materialized!
                </span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setStep(1)}>
                Start Another Import
              </Button>
            </div>
          )}
        </Card>

        {/* Import History & RevertImport (FR-3.1) */}
        <Card title="Import History & Rollback (RevertImport)">
          <div className="divide-y divide-[var(--border-primary)]">
            {imports.map((imp) => (
              <div
                key={imp.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{imp.fileName}</span>
                    <Pill label={imp.format} color="#3b82f6" />
                    <Pill
                      label={imp.status}
                      color={imp.status === 'COMPLETED' ? '#10b981' : '#ef4444'}
                    />
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {imp.rowCount} rows • Imported on {imp.createdAt}
                  </div>
                </div>
                {imp.status === 'COMPLETED' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => revertImportBatch(imp.id)}
                  >
                    Revert Import
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* FR-3.2 Rule Engine & Dry-Run Preview */}
      <Section
        title="Automated Rule Engine & Dry-Run Preview (FR-3.2)"
        description="Evaluate merchant, name, notes, and Decimal amount conditions to categorize, rename, or exclude entries"
        action={
          <Button
            size="sm"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={async () => {
              const count = await applyAllRules();
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
                    void createRule({
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
                        onClick={() => void toggleRuleActive(r.id, !r.isActive)}
                      >
                        {r.isActive ? 'Pause' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete rule ${r.name}`}
                        icon={<Trash2 className="w-3.5 h-3.5 text-[var(--status-negative)]" />}
                        onClick={() => void deleteRule(r.id)}
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

      {/* Dry-Run Preview Dialog (server-evaluated via POST /api/v1/rules/dry-run) */}
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
              <MoneyAmount value={m.amount} currency={family.baseCurrency} />
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
};
