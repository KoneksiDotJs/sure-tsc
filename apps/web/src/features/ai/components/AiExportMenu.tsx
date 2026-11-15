import React, { useEffect, useState } from 'react';
import { Download, EyeOff, FileCode2, FileText, FileType2, Loader2 } from 'lucide-react';
import type { AiChatExportFormat } from '@sure/shared';

interface AiExportMenuProps {
  disabled: boolean;
  isExporting: boolean;
  defaultRedact: boolean;
  onExport: (format: AiChatExportFormat, redactAmounts: boolean) => Promise<void>;
}

export const AiExportMenu: React.FC<AiExportMenuProps> = ({
  disabled,
  isExporting,
  defaultRedact,
  onExport,
}) => {
  const [open, setOpen] = useState(false);
  const [redact, setRedact] = useState(defaultRedact);

  useEffect(() => {
    setRedact(defaultRedact);
  }, [defaultRedact]);

  const handleSelect = async (format: AiChatExportFormat) => {
    setOpen(false);
    await onExport(format, redact);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || isExporting}
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
        title={disabled ? 'Send a message first to export this chat' : 'Export conversation (PDF, DOCX, Markdown)'}
        aria-label="Export conversation"
      >
        {isExporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-lg z-20 p-2 space-y-1.5">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Export Conversation
          </div>

          <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-secondary)] cursor-pointer select-none">
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              Redact amounts
            </span>
            <input
              type="checkbox"
              checked={redact}
              onChange={(e) => setRedact(e.target.checked)}
              className="accent-[var(--accent-primary)]"
            />
          </label>

          <button
            type="button"
            onClick={() => void handleSelect('pdf')}
            className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2 cursor-pointer"
          >
            <FileType2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <div>
              <div className="font-medium">PDF Document (.pdf)</div>
              <div className="text-[10px] text-[var(--text-muted)]">Formatted report with tables</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleSelect('docx')}
            className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <div>
              <div className="font-medium">Word Document (.docx)</div>
              <div className="text-[10px] text-[var(--text-muted)]">Editable Microsoft Word file</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleSelect('md')}
            className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div>
              <div className="font-medium">Markdown (.md)</div>
              <div className="text-[10px] text-[var(--text-muted)]">Clean plain-text &amp; tables</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
