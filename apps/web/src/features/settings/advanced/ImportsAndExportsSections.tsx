import React, { useState } from 'react';
import { Pill } from '@sure/ui';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { useLedger } from '../../../lib/ledger-context.js';

interface ExportRecord {
  id: string;
  createdAt: string;
  fileName: string;
  countsSummary: string;
}

export const ImportsSection: React.FC<{
  onNavigateToImports?: () => void;
}> = ({ onNavigateToImports }) => {
  const { accounts, imports, revertImportBatch } = useLedger();

  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        IMPORTS <span className="mx-1">•</span> {imports.length}
      </div>

      {imports.length === 0 ? (
        <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
          No historical imports recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Operation</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {imports.map((imp) => {
                const acc = accounts.find((a) => a.id === imp.accountId);
                return (
                  <tr key={imp.id} className="hover:bg-[var(--bg-surface-hover)]/40">
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-mono-tabular">
                      {imp.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{imp.fileName}</div>
                      <div className="text-[var(--text-secondary)]">
                        {acc?.name ?? 'Account'} • {imp.format} ({imp.rowCount} rows)
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        label={imp.status}
                        color={
                          imp.status === 'COMPLETED'
                            ? '#078C52'
                            : imp.status === 'STAGED'
                              ? '#f59e0b'
                              : '#64748b'
                        }
                        size="xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {imp.status !== 'REVERTED' && (
                        <button
                          type="button"
                          aria-label={`Revert ${imp.fileName}`}
                          onClick={() => void revertImportBatch(imp.id)}
                          className="p-1.5 rounded-md text-[var(--status-negative)] hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {onNavigateToImports && (
        <button
          type="button"
          onClick={onNavigateToImports}
          className="w-full py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border-t border-[var(--border-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Import</span>
        </button>
      )}
    </div>
  );
};

export const ExportsSection: React.FC = () => {
  const { family, accounts, entries, downloadFamilyBackup } = useLedger();

  const [exportBusy, setExportBusy] = useState(false);
  const [exportLogs, setExportLogs] = useState<ExportRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`sure:exports:${family.id}`);
        if (raw) return JSON.parse(raw) as ExportRecord[];
      } catch {
        // Ignore
      }
    }
    return [];
  });

  const handleCreateExport = async () => {
    setExportBusy(true);
    try {
      await downloadFamilyBackup();
      const rec: ExportRecord = {
        id: `exp-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        fileName: `sure-family-${family.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
        countsSummary: `${accounts.length} accounts • ${entries.length} entries`,
      };
      setExportLogs((prev) => {
        const next = [rec, ...prev].slice(0, 20);
        try {
          window.localStorage.setItem(`sure:exports:${family.id}`, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        EXPORTS <span className="mx-1">•</span> {exportLogs.length}
      </div>

      {exportLogs.length === 0 ? (
        <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
          No exports yet.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-primary)]">
          {exportLogs.map((exp) => (
            <div key={exp.id} className="flex items-center justify-between px-4 py-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-[var(--status-positive)]" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{exp.fileName}</div>
                  <div className="text-[var(--text-secondary)]">
                    {exp.createdAt} • {exp.countsSummary}
                  </div>
                </div>
              </div>
              <Pill label="Downloaded" color="#078C52" size="xs" />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={exportBusy}
        onClick={() => void handleCreateExport()}
        className="w-full py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border-t border-[var(--border-primary)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
      >
        <Upload className="w-3.5 h-3.5" />
        <span>{exportBusy ? 'Generating Export...' : '+ New Export'}</span>
      </button>
    </div>
  );
};
