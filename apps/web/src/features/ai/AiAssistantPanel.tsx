import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Pill } from '@sure/ui';
import {
  Check,
  Copy,
  Loader2,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { apiRequest } from '../../lib/api-client.js';

export interface AiChatMessageItem {
  id: string;
  role: 'USER' | 'ASSISTANT';
  text: string;
  toolCalled?: string;
  modelUsed?: string;
  providerUsed?: string;
  tokensSummary?: string;
}

interface ActiveAiConfigSummary {
  resolvedProvider: string;
  model: string;
  hasApiKey: boolean;
  source: 'family' | 'env' | 'none';
}

const QUICK_PROMPTS = [
  'Summarize my net worth & balances',
  'Analyze my spending & savings rate',
  'Make a 1-month financial plan',
  'How can I optimize my top expenses?',
];

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[var(--text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[11px] font-mono-tabular"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-[var(--text-secondary)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(trimmed);
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const MarkdownMessageBody: React.FC<{ content: string }> = ({ content }) => {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const out: Array<
      | { type: 'heading'; level: number; text: string }
      | { type: 'list'; ordered: boolean; items: string[] }
      | { type: 'table'; headers: string[]; rows: string[][] }
      | { type: 'paragraph'; text: string }
    > = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      // Markdown Pipe Table
      if (
        trimmed.includes('|') &&
        i + 1 < lines.length &&
        isTableSeparatorLine(lines[i + 1] ?? '')
      ) {
        const headers = splitTableCells(trimmed);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && (lines[i] ?? '').trim().includes('|')) {
          rows.push(splitTableCells(lines[i]!));
          i += 1;
        }
        out.push({ type: 'table', headers, rows });
        continue;
      }

      // Heading (#, ##, ###)
      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        out.push({
          type: 'heading',
          level: headingMatch[1]!.length,
          text: headingMatch[2]!,
        });
        i += 1;
        continue;
      }

      // Bullet or Numbered List
      if (/^([•\-*]|\d+\.)\s+/.test(trimmed)) {
        const ordered = /^\d+\.\s+/.test(trimmed);
        const items: string[] = [];
        while (i < lines.length) {
          const cur = (lines[i] ?? '').trim();
          const m = cur.match(/^(?:[•\-*]|\d+\.)\s+(.+)$/);
          if (!m) break;
          items.push(m[1]!);
          i += 1;
        }
        out.push({ type: 'list', ordered, items });
        continue;
      }

      // Paragraph lines grouped until blank line or next structural block
      const paraLines: string[] = [trimmed];
      i += 1;
      while (i < lines.length) {
        const nextLine = (lines[i] ?? '').trim();
        if (
          !nextLine ||
          /^(#{1,4})\s+/.test(nextLine) ||
          /^([•\-*]|\d+\.)\s+/.test(nextLine) ||
          (nextLine.includes('|') &&
            i + 1 < lines.length &&
            isTableSeparatorLine(lines[i + 1] ?? ''))
        ) {
          break;
        }
        paraLines.push(nextLine);
        i += 1;
      }
      out.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
    return out;
  }, [content]);

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed break-words [overflow-wrap:anywhere]">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <div
              key={idx}
              className="font-semibold text-[var(--text-primary)] text-[13.5px] pt-0.5"
            >
              {renderInlineMarkdown(block.text)}
            </div>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={idx}
              className={`space-y-1 pl-4 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
            >
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="leading-relaxed">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'table') {
          return (
            <div
              key={idx}
              className="w-full overflow-x-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)]"
            >
              <table className="w-full border-collapse text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                    {block.headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-2.5 py-1.5 font-semibold text-[var(--text-primary)] whitespace-nowrap"
                      >
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b last:border-b-0 border-[var(--border-primary)]"
                    >
                      {block.headers.map((_, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-2.5 py-1.5 align-top text-[var(--text-secondary)]"
                        >
                          {renderInlineMarkdown(row[cIdx] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-line leading-relaxed">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
};

export interface AiAssistantPanelProps {
  familyName: string;
  aiEnabled: boolean;
  darkMode: boolean;
  messages: AiChatMessageItem[];
  input: string;
  isSending: boolean;
  onInputChange: (val: string) => void;
  onSend: (promptOverride?: string) => void;
  onClearChat: () => void;
  onEnableAi: () => void;
  onOpenAiSettings?: () => void;
  onClose?: () => void;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  aiEnabled,
  darkMode,
  messages,
  input,
  isSending,
  onInputChange,
  onSend,
  onClearChat,
  onEnableAi,
  onOpenAiSettings,
  onClose,
}) => {
  const [activeAiConfig, setActiveAiConfig] = useState<ActiveAiConfigSummary | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void apiRequest<ActiveAiConfigSummary>('/api/v1/ai/config')
      .then(setActiveAiConfig)
      .catch(() => null);
  }, [aiEnabled, messages.length]);

  useEffect(() => {
    if (!isSending) {
      setElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSending]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isSending]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // Clipboard may be unavailable in non-HTTPS contexts
    }
  };

  const activeModelBadge = activeAiConfig
    ? activeAiConfig.hasApiKey || activeAiConfig.resolvedProvider === 'ollama'
      ? `${activeAiConfig.resolvedProvider.toUpperCase()} · ${activeAiConfig.model}`
      : 'Local Decimal Engine (No API Key)'
    : 'Loading model...';

  return (
    <div className="relative flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      {/* Header with active model badge */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--border-primary)] shrink-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <img
            src={darkMode ? '/images/ai-dark.svg' : '/images/ai.svg'}
            alt="Sure AI"
            className="w-6 h-6 mt-0.5 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight text-[var(--text-primary)]">
              Sure AI Assistant
            </div>
            <div className="mt-1 flex items-center gap-1.5 min-w-0">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isSending
                    ? 'bg-amber-500 animate-ping'
                    : activeAiConfig?.hasApiKey || activeAiConfig?.resolvedProvider === 'ollama'
                      ? 'bg-emerald-500'
                      : 'bg-[var(--text-muted)]'
                }`}
              />
              <span
                className="text-[11px] font-mono-tabular text-[var(--text-secondary)] truncate"
                title={activeModelBadge}
              >
                {activeModelBadge}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenAiSettings && (
            <button
              type="button"
              onClick={onOpenAiSettings}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
              title="Configure AI model & API key"
              aria-label="Configure AI model"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClearChat}
            disabled={isSending || messages.length <= 1}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
            title="Reset conversation"
            aria-label="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
              aria-label="Close AI sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Conversation Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 pr-1 space-y-3">
        {messages.map((msg) => {
          const isUser = msg.role === 'USER';
          return (
            <div
              key={msg.id}
              className={`group rounded-xl p-3 max-w-full min-w-0 ${
                isUser
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] ml-8 text-[13px] leading-relaxed break-words'
                  : 'bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] mr-1'
              }`}
            >
              {!isUser && (
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {msg.modelUsed ? (
                      <Pill
                        size="xs"
                        color="#3b82f6"
                        label={`${msg.providerUsed ? `${msg.providerUsed}: ` : ''}${msg.modelUsed}`}
                      />
                    ) : msg.toolCalled ? (
                      <Pill size="xs" color="#078C52" label={msg.toolCalled} />
                    ) : null}
                    {msg.tokensSummary && (
                      <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">
                        {msg.tokensSummary}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(msg.id, msg.text)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    title="Copy response"
                    aria-label="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}

              {isUser ? (
                <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.text}</div>
              ) : (
                <MarkdownMessageBody content={msg.text} />
              )}
            </div>
          );
        })}

        {/* Reasoning / Buffering Indicator */}
        {isSending && (
          <div className="rounded-xl p-3.5 mr-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] space-y-2 animate-pulse">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-spin shrink-0" />
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                  Reasoning with{' '}
                  <span className="font-mono-tabular">
                    {activeAiConfig?.model || 'AI model'}
                  </span>
                </span>
              </div>
              <span className="text-[10px] font-mono-tabular text-[var(--text-muted)] shrink-0">
                {elapsedSec}s
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <span>Querying family ledger &amp; generating response</span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[var(--text-secondary)] animate-bounce" />
                <span
                  className="w-1 h-1 rounded-full bg-[var(--text-secondary)] animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-1 h-1 rounded-full bg-[var(--text-secondary)] animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Quick Suggestions Row when conversation hasn't started or finished */}
      {aiEnabled && !isSending && messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5 pb-2 pt-1 shrink-0">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => onSend(qp)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-hover)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Sparkles className="w-2.5 h-2.5 shrink-0 text-[var(--accent-primary)]" />
              <span>{qp}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="flex items-end gap-2 pt-3 border-t border-[var(--border-primary)] shrink-0"
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!isSending && input.trim()) {
                onSend();
              }
            }
          }}
          disabled={!aiEnabled || isSending}
          placeholder={
            isSending
              ? 'Waiting for model response...'
              : 'Ask about Net Worth, Cash Flow, or Budget plans...'
          }
          className="flex-1 min-w-0 max-h-28 resize-none px-3 py-2 text-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] focus:outline-none focus:border-[var(--text-primary)] disabled:opacity-50"
        />
        <Button
          type="submit"
          size="md"
          disabled={!aiEnabled || isSending || !input.trim()}
          icon={
            isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )
          }
        >
          {isSending ? 'Thinking' : 'Send'}
        </Button>
      </form>

      {/* AI Consent Overlay */}
      {!aiEnabled && (
        <div className="absolute inset-0 z-10 backdrop-blur-md bg-[var(--bg-canvas)]/75 flex items-center justify-center p-5">
          <div className="w-full p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <img
                src={darkMode ? '/images/ai-dark.svg' : '/images/ai.svg'}
                alt=""
                className="w-5 h-5"
              />
              <h3 className="text-sm font-semibold">AI Consent Required</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Your family ledger is private by default. Opt in to allow Sure AI to query balances,
              cash flow, and budgets using <code>family.aiEnabled</code>.
            </p>
            <Button size="sm" className="w-full justify-center" onClick={onEnableAi}>
              Enable Sure AI
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
