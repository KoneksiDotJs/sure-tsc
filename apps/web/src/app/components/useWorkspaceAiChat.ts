import { useCallback, useEffect, useState } from 'react';
import type { AiChatExportFormat } from '@sure/shared';
import { apiDownloadBlob, apiRequest } from '../../lib/api-client.js';
import type { AiChatMessageItem } from '../../features/ai/AiAssistantPanel.js';
import type { AiChatHistorySummary } from '../../features/ai/components/AiHistoryDrawer.js';

const INITIAL_WELCOME_MESSAGE: AiChatMessageItem = {
  id: 'm-1',
  role: 'ASSISTANT',
  text: 'Welcome to Sure AI Financial Assistant. Ask me about your Net Worth, Cash Flow Sankey, Budget Rollovers, or ask me to create rules and transactions.',
  toolCalled: 'get_balance_sheet',
};

interface ApiChatMessageRecord {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL';
  content: string;
  toolCalls?: Array<{
    toolName: string;
    args?: { model?: string };
    resultSummary?: string;
  }> | null;
}

interface ApiChatRecord {
  id: string;
  title: string;
  messages: ApiChatMessageRecord[];
}

function mapApiMessagesToUi(messages: ApiChatMessageRecord[]): AiChatMessageItem[] {
  return messages
    .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
    .map((m) => {
      if (m.role === 'USER') {
        return {
          id: m.id,
          role: 'USER',
          text: m.content,
        };
      }

      const calls = Array.isArray(m.toolCalls) ? m.toolCalls : [];
      const llmCall = calls.find((c) => c.toolName.startsWith('llm_'));
      const nonLlmTools = calls
        .filter((c) => !c.toolName.startsWith('llm_'))
        .map((c) => c.toolName)
        .join(' & ');

      return {
        id: m.id,
        role: 'ASSISTANT',
        text: m.content,
        toolCalled: nonLlmTools || undefined,
        providerUsed: llmCall ? llmCall.toolName.replace(/^llm_/, '') : undefined,
        modelUsed: llmCall?.args?.model,
        tokensSummary: llmCall?.resultSummary,
      };
    });
}

export function useWorkspaceAiChat(familyId: string, aiEnabled: boolean) {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatTitle, setActiveChatTitle] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<AiChatHistorySummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiSending, setIsAiSending] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<AiChatMessageItem[]>([
    INITIAL_WELCOME_MESSAGE,
  ]);

  const refreshHistory = useCallback(async () => {
    if (!familyId) return;
    setIsLoadingHistory(true);
    try {
      const list = await apiRequest<AiChatHistorySummary[]>('/api/v1/ai/chats');
      setChatHistory(list);
    } catch {
      // Non-fatal history refresh
    } finally {
      setIsLoadingHistory(false);
    }
  }, [familyId]);

  useEffect(() => {
    setActiveChatId(null);
    setActiveChatTitle(null);
    setChatMessages([INITIAL_WELCOME_MESSAGE]);
    void refreshHistory();
  }, [familyId, refreshHistory]);

  const selectChat = async (chatId: string) => {
    setIsLoadingHistory(true);
    try {
      const chat = await apiRequest<ApiChatRecord>(`/api/v1/ai/chats/${chatId}`);
      setActiveChatId(chat.id);
      setActiveChatTitle(chat.title);
      const mapped = mapApiMessagesToUi(chat.messages ?? []);
      setChatMessages(mapped.length > 0 ? mapped : [INITIAL_WELCOME_MESSAGE]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setActiveChatTitle(null);
    setChatMessages([INITIAL_WELCOME_MESSAGE]);
  };

  const renameChat = async (chatId: string, title: string) => {
    const updated = await apiRequest<{ id: string; title: string }>(`/api/v1/ai/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
    if (activeChatId === chatId) {
      setActiveChatTitle(updated.title);
    }
    setChatHistory((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: updated.title } : c))
    );
  };

  const deleteChat = async (chatId: string) => {
    await apiRequest(`/api/v1/ai/chats/${chatId}`, { method: 'DELETE' });
    setChatHistory((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) {
      startNewChat();
    }
  };

  const exportChat = async (
    chatId: string,
    format: AiChatExportFormat,
    redactAmounts = false
  ) => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        redact: redactAmounts ? 'true' : 'false',
      });
      const { blob, filename } = await apiDownloadBlob(
        `/api/v1/ai/chats/${chatId}/export?${params.toString()}`
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `sure-ai-chat.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsExporting(false);
    }
  };

  const sendMessage = async (promptOverride?: string) => {
    const raw = promptOverride ?? chatInput;
    if (!raw.trim() || !aiEnabled || isAiSending) return;
    const userPrompt = raw.trim();
    if (!promptOverride) {
      setChatInput('');
    }

    setChatMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'USER', text: userPrompt },
    ]);
    setIsAiSending(true);

    try {
      let customSystemPrompt: string | undefined;
      try {
        const storedPrompts = window.localStorage.getItem(`sure:ai_prompts:${familyId}`);
        if (storedPrompts) {
          const parsed = JSON.parse(storedPrompts) as { mainSystem?: string };
          if (parsed.mainSystem?.trim()) {
            customSystemPrompt = parsed.mainSystem.trim().slice(0, 4000);
          }
        }
      } catch {
        // Ignore storage read errors
      }

      const chat = await apiRequest<ApiChatRecord>('/api/v1/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          ...(activeChatId ? { chatId: activeChatId } : {}),
          prompt: userPrompt,
          ...(customSystemPrompt ? { systemPrompt: customSystemPrompt } : {}),
        }),
      });

      setActiveChatId(chat.id);
      setActiveChatTitle(chat.title);
      const mapped = mapApiMessagesToUi(chat.messages ?? []);
      if (mapped.length > 0) {
        setChatMessages(mapped);
      }
      void refreshHistory();
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'ASSISTANT',
          text: err instanceof Error ? err.message : 'Unable to reach AI Assistant endpoint.',
        },
      ]);
    } finally {
      setIsAiSending(false);
    }
  };

  return {
    activeChatId,
    activeChatTitle,
    chatHistory,
    isLoadingHistory,
    isExporting,
    chatInput,
    setChatInput,
    isAiSending,
    chatMessages,
    sendMessage,
    clearChat: startNewChat,
    selectChat,
    renameChat,
    deleteChat,
    exportChat,
  };
}
