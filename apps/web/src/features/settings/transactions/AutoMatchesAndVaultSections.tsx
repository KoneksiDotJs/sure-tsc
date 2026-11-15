import React, { useEffect, useMemo, useState } from 'react';
import { ImportFormat } from '@sure/shared';
import { Alert, Button, Card, MoneyAmount, Pill, Toggle } from '@sure/ui';
import { Archive, Check, Link2, RefreshCw, Upload, X } from 'lucide-react';
import { useLedger, WebTransferSuggestion } from '../../../lib/ledger-context.js';

interface VaultLocalFile {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AutoMatchesSection: React.FC<{
  enableAutoMatch: boolean;
  onToggleAutoMatch: (enabled: boolean) => void;
}> = ({ enableAutoMatch, onToggleAutoMatch }) => {
  const { family, fetchTransferSuggestions, matchTransfer } = useLedger();

  const [suggestions, setSuggestions] = useState<WebTransferSuggestion[]>([]);
  const [dismissedMatchKeys, setDismissedMatchKeys] = useState<Record<string, boolean>>({});
  const [matchesLoading, setMatchesLoading] = useState(false);

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
    void loadTransferSuggestions();
  }, []);

  const visibleSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) => !dismissedMatchKeys[`${s.outflowEntryId}:${s.inflowEntryId}`]
      ),
    [suggestions, dismissedMatchKeys]
  );

  return (
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
  );
};

export const StatementVaultSection: React.FC = () => {
  const { accounts, imports, previewImportFile } = useLedger();

  const [vaultAccountId, setVaultAccountId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [unmatchedFiles, setUnmatchedFiles] = useState<VaultLocalFile[]>([]);
  const [vaultStatus, setVaultStatus] = useState<string | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);

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
  );
};
