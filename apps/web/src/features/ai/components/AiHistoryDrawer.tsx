import React, { useMemo, useState } from 'react';
import { Button } from '@sure/ui';
import { Check, FileDown, MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react';

export interface AiChatHistorySummary {
  id: string;
  title: string;
  tokenCount: number;
  messageCount: number;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
}

interface AiHistoryDrawerProps {
  chats: AiChatHistorySummary[];
  activeChatId: string | null;
  isLoading: boolean;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onRenameChat: (chatId: string, title: string) => Promise<void>;
  onDeleteChat: (chatId: string) => Promise<void>;
  onQuickExportPdf: (chatId: string) => Promise<void>;
  onClose: () => void;
}

export const AiHistoryDrawer: React.FC<AiHistoryDrawerProps> = ({
  chats,
  activeChatId,
  isLoading,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onQuickExportPdf,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q)
    );
  }, [chats, search]);

  const handleCommitRename = async (chatId: string) => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setBusyId(chatId);
    try {
      await onRenameChat(chatId, trimmed);
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] p-2.5 space-y-2 shrink-0 max-h-[280px] flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          Saved Conversations ({chats.length})
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            icon={<Plus className="w-3 h-3" />}
          >
            New
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat history"
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter saved chats..."
        className="w-full h-7 px-2 text-xs rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
      />

      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {isLoading ? (
          <div className="py-4 text-center text-[11px] text-[var(--text-muted)]">
            Loading conversation history...
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-[var(--text-muted)]">
            No saved AI chats yet. Send a message to start one.
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isEditing = editingId === chat.id;

            return (
              <div
                key={chat.id}
                className={`rounded-lg px-2 py-1.5 transition-colors border ${
                  isActive
                    ? 'bg-[var(--bg-surface)] border-[var(--border-strong)]'
                    : 'border-transparent hover:bg-[var(--bg-surface)]'
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCommitRename(chat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 h-6 px-1.5 text-xs rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      disabled={busyId === chat.id}
                      onClick={() => void handleCommitRename(chat.id)}
                      className="p-1 text-emerald-500 hover:bg-[var(--bg-surface-subtle)] rounded"
                      aria-label="Save title"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectChat(chat.id);
                        onClose();
                      }}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {chat.title}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono-tabular">
                        {chat.updatedAt.slice(0, 10)} · {chat.messageCount} msgs
                        {chat.tokenCount > 0 ? ` · ${chat.tokenCount} tok` : ''}
                      </div>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onQuickExportPdf(chat.id)}
                        title="Export PDF"
                        aria-label="Export conversation as PDF"
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                      >
                        <FileDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(chat.id);
                          setDraftTitle(chat.title);
                        }}
                        title="Rename chat"
                        aria-label="Rename conversation"
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteChat(chat.id)}
                        title="Delete chat"
                        aria-label="Delete conversation"
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--status-negative)] hover:bg-[var(--bg-surface-subtle)]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
