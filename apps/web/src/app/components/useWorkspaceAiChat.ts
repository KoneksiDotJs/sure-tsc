import { useState } from 'react';
import { apiRequest } from '../../lib/api-client.js';
import type { AiChatMessageItem } from '../../features/ai/AiAssistantPanel.js';

const INITIAL_WELCOME_MESSAGE: AiChatMessageItem = {
  id: 'm-1',
  role: 'ASSISTANT',
  text: 'Welcome to Sure AI Financial Assistant. Ask me about your Net Worth, Cash Flow Sankey, Budget Rollovers, or ask me to create rules and transactions.',
  toolCalled: 'get_balance_sheet',
};

export function useWorkspaceAiChat(familyId: string, aiEnabled: boolean) {
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiSending, setIsAiSending] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<AiChatMessageItem[]>([
    INITIAL_WELCOME_MESSAGE,
  ]);

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

      const chat = await apiRequest<{
        messages: Array<{
          id: string;
          role: 'USER' | 'ASSISTANT';
          content: string;
          toolCalls?: Array<{
            toolName: string;
            args?: { model?: string };
            resultSummary?: string;
          }> | null;
        }>;
      }>('/api/v1/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: userPrompt,
          ...(customSystemPrompt ? { systemPrompt: customSystemPrompt } : {}),
        }),
      });

      const assistantMsg = [...(chat.messages ?? [])]
        .reverse()
        .find((m) => m.role === 'ASSISTANT');

      if (assistantMsg) {
        const calls = Array.isArray(assistantMsg.toolCalls) ? assistantMsg.toolCalls : [];
        const llmCall = calls.find((c) => c.toolName.startsWith('llm_'));
        const nonLlmTools = calls
          .filter((c) => !c.toolName.startsWith('llm_'))
          .map((c) => c.toolName)
          .join(' & ');
        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantMsg.id,
            role: 'ASSISTANT',
            text: assistantMsg.content,
            toolCalled: nonLlmTools || undefined,
            providerUsed: llmCall ? llmCall.toolName.replace(/^llm_/, '') : undefined,
            modelUsed: llmCall?.args?.model,
            tokensSummary: llmCall?.resultSummary,
          },
        ]);
      }
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

  const clearChat = () => setChatMessages([INITIAL_WELCOME_MESSAGE]);

  return {
    chatInput,
    setChatInput,
    isAiSending,
    chatMessages,
    sendMessage,
    clearChat,
  };
}
