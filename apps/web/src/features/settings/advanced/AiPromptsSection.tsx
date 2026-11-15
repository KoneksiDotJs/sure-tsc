import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Disclosure, Pill } from '@sure/ui';
import {
  ExternalLink,
  Key,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Store,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api-client.js';
import { useLedger } from '../../../lib/ledger-context.js';

const DEFAULT_PROMPTS = {
  mainSystem: `## Your identity
You are a friendly financial assistant for an open source personal finance application called "Sure".

## Your purpose
You help users understand their financial data by answering questions about their accounts, transactions, income, expenses, net worth, budgets, forecasting and more.

## How to handle a request
1. Scope every calculation strictly to the authenticated family's fixed-point Decimal ledger.
2. Never fabricate account balances, dates, or transaction amounts.`,
  categorizer: `Categorize transactions into the given categories. Return JSON only. Do not explain your reasoning.

CRITICAL RULES:
1. Match transaction_id exactly from input
2. Use EXACT category_name from the provided list, or "null" if unsure
3. Match expense transactions to expense categories only`,
  merchantDetector: `Detect business names and websites from transaction descriptions. Return JSON only.

Rules:
1. Match transaction_id exactly from input
2. Return business_name and business_url for known businesses
3. Return "null" for both if uncertain or generic (e.g. "Paycheck", "Local diner")
4. Don't include "www." in URLs (use "amazon.com" not "www.amazon.com")
5. Favor "null" over guessing - only return values if 80%+ confident`,
  insightDigIn: `Help me dig into this insight.

Insight: %{title}
What Sure found: %{body}
Period: %{period}`,
};

type AiProviderId = 'groq' | 'gemini' | 'openrouter' | 'ollama' | 'openai' | 'anthropic';

interface AiModelOption {
  id: string;
  name: string;
  isFree: boolean;
  contextLength?: number;
}

interface AiProviderPresetInfo {
  id: AiProviderId;
  label: string;
  tier: 'free-cloud' | 'free-local' | 'paid';
  defaultModel: string;
  endpointUrl: string;
  requiresKey: boolean;
  signupUrl: string;
  envVarName: string;
  notes: string;
}

interface SafeAiConfigState {
  provider: 'auto' | AiProviderPresetInfo['id'];
  resolvedProvider: AiProviderPresetInfo['id'];
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  maskedKey: string | null;
  source: 'family' | 'env' | 'none';
  providers: AiProviderPresetInfo[];
}

export const AiPromptsSection: React.FC = () => {
  const { family, updateFamilySettings } = useLedger();

  const [prompts, setPrompts] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`sure:ai_prompts:${family.id}`);
        if (raw) return { ...DEFAULT_PROMPTS, ...JSON.parse(raw) };
      } catch {
        // Ignore storage read errors
      }
    }
    return DEFAULT_PROMPTS;
  });

  const [categorizerProvider, setCategorizerProvider] = useState<AiProviderId | 'bayes'>(() => {
    const rawVal = (prompts as { categorizerProvider?: string }).categorizerProvider;
    return (rawVal as AiProviderId | 'bayes') || 'openrouter';
  });
  const [categorizerModel, setCategorizerModel] = useState<string>(
    () => (prompts as { categorizerModel?: string }).categorizerModel || ''
  );
  const [merchantProvider, setMerchantProvider] = useState<AiProviderId>(() => {
    const rawVal = (prompts as { merchantProvider?: string }).merchantProvider;
    return (rawVal as AiProviderId) || 'openrouter';
  });
  const [merchantModel, setMerchantModel] = useState<string>(
    () => (prompts as { merchantModel?: string }).merchantModel || ''
  );
  const [promptsSavedMsg, setPromptsSavedMsg] = useState<string | null>(null);

  const [aiConfig, setAiConfig] = useState<SafeAiConfigState | null>(null);
  const [aiProviderDraft, setAiProviderDraft] = useState<AiProviderId>('openrouter');
  const [aiApiKeyDraft, setAiApiKeyDraft] = useState('');
  const [aiModelDraft, setAiModelDraft] = useState('');
  const [aiBaseUrlDraft, setAiBaseUrlDraft] = useState('');
  const [customModelMode, setCustomModelMode] = useState(false);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, AiModelOption[]>>({});
  const [modelsSourceByProvider, setModelsSourceByProvider] = useState<
    Record<string, 'live' | 'curated'>
  >({});
  const [modelsLoadingProvider, setModelsLoadingProvider] = useState<string | null>(null);
  const [aiConfigBusy, setAiConfigBusy] = useState(false);
  const [aiConfigMsg, setAiConfigMsg] = useState<{
    kind: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const loadModelsForProvider = async (
    providerId: AiProviderId,
    opts?: { apiKey?: string; baseUrl?: string; model?: string }
  ) => {
    setModelsLoadingProvider(providerId);
    try {
      const data = await apiRequest<{
        provider: AiProviderId;
        source: 'live' | 'curated';
        models: AiModelOption[];
      }>('/api/v1/ai/models', {
        method: 'POST',
        body: JSON.stringify({
          provider: providerId,
          ...(opts?.apiKey?.trim() ? { apiKey: opts.apiKey.trim() } : {}),
          ...(opts?.baseUrl?.trim() ? { baseUrl: opts.baseUrl.trim() } : {}),
          ...(opts?.model?.trim() ? { model: opts.model.trim() } : {}),
        }),
      });
      setModelsByProvider((prev) => ({ ...prev, [data.provider]: data.models }));
      setModelsSourceByProvider((prev) => ({ ...prev, [data.provider]: data.source }));
      return data.models;
    } catch {
      return [];
    } finally {
      setModelsLoadingProvider((curr) => (curr === providerId ? null : curr));
    }
  };

  useEffect(() => {
    void apiRequest<SafeAiConfigState>('/api/v1/ai/config')
      .then((cfg) => {
        setAiConfig(cfg);
        const resolved = cfg.resolvedProvider || 'openrouter';
        setAiProviderDraft(resolved);
        setAiModelDraft(cfg.model || '');
        setAiBaseUrlDraft(cfg.baseUrl || '');
        if (!(prompts as { categorizerProvider?: string }).categorizerProvider) {
          setCategorizerProvider(resolved);
        }
        if (!(prompts as { merchantProvider?: string }).merchantProvider) {
          setMerchantProvider(resolved);
        }
        void loadModelsForProvider(resolved, {
          baseUrl: cfg.baseUrl,
          model: cfg.model,
        });
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (categorizerProvider !== 'bayes' && !modelsByProvider[categorizerProvider]) {
      void loadModelsForProvider(categorizerProvider);
    }
    if (!modelsByProvider[merchantProvider]) {
      void loadModelsForProvider(merchantProvider);
    }
  }, [categorizerProvider, merchantProvider]);

  const activePreset = useMemo(
    () => aiConfig?.providers.find((p) => p.id === aiProviderDraft) ?? null,
    [aiConfig, aiProviderDraft]
  );

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiConfigMsg(null);
    setAiConfigBusy(true);
    try {
      const updated = await apiRequest<SafeAiConfigState>('/api/v1/ai/config', {
        method: 'PUT',
        body: JSON.stringify({
          provider: aiProviderDraft,
          ...(aiApiKeyDraft.trim() ? { apiKey: aiApiKeyDraft.trim() } : {}),
          model: aiModelDraft.trim() || undefined,
          baseUrl: aiBaseUrlDraft.trim() || undefined,
        }),
      });
      setAiConfig(updated);
      setAiApiKeyDraft('');
      setAiConfigMsg({
        kind: 'success',
        text: `Saved ${updated.resolvedProvider.toUpperCase()} (${updated.model}) configuration.`,
      });
    } catch (err) {
      setAiConfigMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to save AI configuration',
      });
    } finally {
      setAiConfigBusy(false);
    }
  };

  const handleTestAiConnection = async () => {
    setAiConfigMsg(null);
    setAiConfigBusy(true);
    try {
      const res = await apiRequest<{
        ok: boolean;
        provider: string;
        model: string;
        replyPreview: string;
      }>('/api/v1/ai/test', {
        method: 'POST',
        body: JSON.stringify({
          provider: aiProviderDraft,
          ...(aiApiKeyDraft.trim() ? { apiKey: aiApiKeyDraft.trim() } : {}),
          model: aiModelDraft.trim() || undefined,
          baseUrl: aiBaseUrlDraft.trim() || undefined,
        }),
      });
      setAiConfigMsg({
        kind: 'success',
        text: `Connected to ${res.provider.toUpperCase()} (${res.model}): "${res.replyPreview}"`,
      });
    } catch (err) {
      setAiConfigMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : 'AI connection test failed',
      });
    } finally {
      setAiConfigBusy(false);
    }
  };

  const handleClearAiKey = async () => {
    setAiConfigMsg(null);
    setAiConfigBusy(true);
    try {
      const updated = await apiRequest<SafeAiConfigState>('/api/v1/ai/config', {
        method: 'PUT',
        body: JSON.stringify({
          provider: aiProviderDraft,
          clearApiKey: true,
        }),
      });
      setAiConfig(updated);
      setAiApiKeyDraft('');
      setAiConfigMsg({ kind: 'info', text: 'Saved API key cleared.' });
    } catch (err) {
      setAiConfigMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to clear API key',
      });
    } finally {
      setAiConfigBusy(false);
    }
  };

  const handleSavePrompts = () => {
    try {
      window.localStorage.setItem(
        `sure:ai_prompts:${family.id}`,
        JSON.stringify({
          ...prompts,
          categorizerProvider,
          categorizerModel,
          merchantProvider,
          merchantModel,
        })
      );
    } catch {
      // Ignore
    }
    setPromptsSavedMsg(
      'Custom AI prompts, providers, and model selections saved for your family workspace.'
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--text-secondary)]">
          AI Assistant is currently{' '}
          <strong className="text-[var(--text-primary)]">
            {family.aiEnabled ? 'enabled' : 'disabled'}
          </strong>{' '}
          for {family.name}.
        </span>
        <Button
          size="sm"
          variant={family.aiEnabled ? 'destructive' : 'primary'}
          onClick={() => void updateFamilySettings({ aiEnabled: !family.aiEnabled })}
        >
          {family.aiEnabled ? 'Disable AI Assistant' : 'Enable AI Assistant'}
        </Button>
      </div>

      {promptsSavedMsg && (
        <Alert variant="success" title="Prompts Updated">
          {promptsSavedMsg}
        </Alert>
      )}

      <Disclosure
        defaultOpen={false}
        title={
          <span className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>
              <span className="block text-sm font-semibold">Main System Prompt</span>
              <span className="block text-xs font-normal text-[var(--text-secondary)]">
                Core instructions that define how the AI assistant behaves in all chat conversations
              </span>
            </span>
          </span>
        }
      >
        <div className="space-y-2.5">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPrompts((p: typeof DEFAULT_PROMPTS) => ({
                  ...p,
                  mainSystem: DEFAULT_PROMPTS.mainSystem,
                }))
              }
            >
              Reset to default
            </Button>
          </div>
          <textarea
            rows={7}
            maxLength={20000}
            value={prompts.mainSystem}
            onChange={(e) =>
              setPrompts((p: typeof DEFAULT_PROMPTS) => ({ ...p, mainSystem: e.target.value }))
            }
            className="w-full px-3 py-2.5 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>
              {prompts.mainSystem === DEFAULT_PROMPTS.mainSystem
                ? 'Using the built-in default'
                : 'Customized prompt'}
            </span>
            <span className="font-mono-tabular">{prompts.mainSystem.length} / 20,000</span>
          </div>
        </div>
      </Disclosure>

      <Disclosure
        defaultOpen={false}
        title={
          <span className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>
              <span className="block text-sm font-semibold">Transaction Categorizer</span>
              <span className="block text-xs font-normal text-[var(--text-secondary)]">
                AI automatically categorizes your transactions based on your defined categories
              </span>
            </span>
          </span>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 bg-[var(--bg-surface)] min-w-[175px]">
                <div className="text-[10px] text-[var(--text-secondary)]">Provider</div>
                <select
                  value={categorizerProvider}
                  onChange={(e) => {
                    const next = e.target.value as typeof categorizerProvider;
                    setCategorizerProvider(next);
                    if (next !== 'bayes') {
                      void loadModelsForProvider(next).then((loaded) => {
                        if (loaded[0]?.id) setCategorizerModel(loaded[0].id);
                      });
                    }
                  }}
                  className="w-full bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="openrouter">OpenRouter (:free)</option>
                  <option value="groq">Groq (Free Tier)</option>
                  <option value="gemini">Google Gemini (Free Tier)</option>
                  <option value="ollama">Ollama (Local Free)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="bayes">Local Bayes</option>
                </select>
              </div>

              {categorizerProvider !== 'bayes' && (
                <div className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 bg-[var(--bg-surface)] min-w-[220px] max-w-[320px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      Model ({modelsByProvider[categorizerProvider]?.length ?? 0})
                    </span>
                    <button
                      type="button"
                      onClick={() => void loadModelsForProvider(categorizerProvider)}
                      className="text-[10px] text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      title="Reload provider models"
                    >
                      <RefreshCw
                        className={`w-2.5 h-2.5 ${modelsLoadingProvider === categorizerProvider ? 'animate-spin' : ''}`}
                      />
                      Load
                    </button>
                  </div>
                  <select
                    value={categorizerModel}
                    onChange={(e) => setCategorizerModel(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono-tabular font-medium text-[var(--text-primary)] focus:outline-none truncate"
                  >
                    {(modelsByProvider[categorizerProvider] ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                    {(modelsByProvider[categorizerProvider]?.length ?? 0) === 0 && (
                      <option value="">Loading models...</option>
                    )}
                  </select>
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPrompts((p: typeof DEFAULT_PROMPTS) => ({
                  ...p,
                  categorizer: DEFAULT_PROMPTS.categorizer,
                }))
              }
            >
              Reset to default
            </Button>
          </div>
          <textarea
            rows={6}
            maxLength={20000}
            value={prompts.categorizer}
            onChange={(e) =>
              setPrompts((p: typeof DEFAULT_PROMPTS) => ({ ...p, categorizer: e.target.value }))
            }
            className="w-full px-3 py-2.5 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>
              {prompts.categorizer === DEFAULT_PROMPTS.categorizer
                ? 'Using the built-in default'
                : 'Customized prompt'}
            </span>
            <span className="font-mono-tabular">{prompts.categorizer.length} / 20,000</span>
          </div>
        </div>
      </Disclosure>

      <Disclosure
        defaultOpen={false}
        title={
          <span className="flex items-center gap-2.5">
            <Store className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>
              <span className="block text-sm font-semibold">Merchant Detector</span>
              <span className="block text-xs font-normal text-[var(--text-secondary)]">
                AI identifies and enriches transaction data with merchant information
              </span>
            </span>
          </span>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 bg-[var(--bg-surface)] min-w-[175px]">
                <div className="text-[10px] text-[var(--text-secondary)]">Provider</div>
                <select
                  value={merchantProvider}
                  onChange={(e) => {
                    const next = e.target.value as typeof merchantProvider;
                    setMerchantProvider(next);
                    void loadModelsForProvider(next).then((loaded) => {
                      if (loaded[0]?.id) setMerchantModel(loaded[0].id);
                    });
                  }}
                  className="w-full bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="openrouter">OpenRouter (:free)</option>
                  <option value="groq">Groq (Free Tier)</option>
                  <option value="gemini">Google Gemini (Free Tier)</option>
                  <option value="ollama">Ollama (Local Free)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>

              <div className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 bg-[var(--bg-surface)] min-w-[220px] max-w-[320px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Model ({modelsByProvider[merchantProvider]?.length ?? 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadModelsForProvider(merchantProvider)}
                    className="text-[10px] text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    title="Reload provider models"
                  >
                    <RefreshCw
                      className={`w-2.5 h-2.5 ${modelsLoadingProvider === merchantProvider ? 'animate-spin' : ''}`}
                    />
                    Load
                  </button>
                </div>
                <select
                  value={merchantModel}
                  onChange={(e) => setMerchantModel(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono-tabular font-medium text-[var(--text-primary)] focus:outline-none truncate"
                >
                  {(modelsByProvider[merchantProvider] ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {(modelsByProvider[merchantProvider]?.length ?? 0) === 0 && (
                    <option value="">Loading models...</option>
                  )}
                </select>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPrompts((p: typeof DEFAULT_PROMPTS) => ({
                  ...p,
                  merchantDetector: DEFAULT_PROMPTS.merchantDetector,
                }))
              }
            >
              Reset to default
            </Button>
          </div>
          <textarea
            rows={6}
            maxLength={20000}
            value={prompts.merchantDetector}
            onChange={(e) =>
              setPrompts((p: typeof DEFAULT_PROMPTS) => ({
                ...p,
                merchantDetector: e.target.value,
              }))
            }
            className="w-full px-3 py-2.5 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>
              {prompts.merchantDetector === DEFAULT_PROMPTS.merchantDetector
                ? 'Using the built-in default'
                : 'Customized prompt'}
            </span>
            <span className="font-mono-tabular">{prompts.merchantDetector.length} / 20,000</span>
          </div>
        </div>
      </Disclosure>

      <Disclosure
        defaultOpen={false}
        title={
          <span className="flex items-center gap-2.5">
            <Lightbulb className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>
              <span className="block text-sm font-semibold">Insight Dig In</span>
              <span className="block text-xs font-normal text-[var(--text-secondary)]">
                First chat message when you dig into an insight with AI
              </span>
            </span>
          </span>
        }
      >
        <div className="space-y-2.5">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPrompts((p: typeof DEFAULT_PROMPTS) => ({
                  ...p,
                  insightDigIn: DEFAULT_PROMPTS.insightDigIn,
                }))
              }
            >
              Reset to default
            </Button>
          </div>
          <textarea
            rows={5}
            maxLength={20000}
            value={prompts.insightDigIn}
            onChange={(e) =>
              setPrompts((p: typeof DEFAULT_PROMPTS) => ({ ...p, insightDigIn: e.target.value }))
            }
            className="w-full px-3 py-2.5 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
        </div>
      </Disclosure>

      <Button className="w-full" onClick={handleSavePrompts}>
        Save prompts
      </Button>

      <Card
        title="Free AI Service & API Key"
        subtitle="Connect a free-tier LLM provider (Groq, Google Gemini, OpenRouter :free) or local Ollama for your Sure AI chatbot"
        action={
          aiConfig && (
            <Pill
              size="xs"
              color={
                aiConfig.hasApiKey || aiConfig.resolvedProvider === 'ollama'
                  ? '#078C52'
                  : '#64748b'
              }
              label={
                aiConfig.hasApiKey
                  ? `${aiConfig.resolvedProvider.toUpperCase()} Key (${aiConfig.maskedKey})`
                  : aiConfig.resolvedProvider === 'ollama'
                    ? 'Ollama Local'
                    : 'Not Configured'
              }
            />
          )
        }
      >
        <form onSubmit={handleSaveAiConfig} className="space-y-3">
          {aiConfigMsg && (
            <Alert
              variant={
                aiConfigMsg.kind === 'error'
                  ? 'error'
                  : aiConfigMsg.kind === 'success'
                    ? 'success'
                    : 'info'
              }
              title={
                aiConfigMsg.kind === 'error'
                  ? 'AI Configuration Error'
                  : aiConfigMsg.kind === 'success'
                    ? 'AI Provider Ready'
                    : 'AI Config Updated'
              }
            >
              {aiConfigMsg.text}
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                AI Provider
              </label>
              <select
                value={aiProviderDraft}
                onChange={(e) => {
                  const nextId = e.target.value as typeof aiProviderDraft;
                  setAiProviderDraft(nextId);
                  const nextBase = nextId === 'ollama' ? 'http://localhost:11434' : '';
                  setAiBaseUrlDraft(nextBase);
                  const preset = aiConfig?.providers.find((p) => p.id === nextId);
                  if (preset) {
                    setAiModelDraft(preset.defaultModel);
                  }
                  void loadModelsForProvider(nextId, {
                    apiKey: aiApiKeyDraft,
                    baseUrl: nextBase,
                  }).then((loaded) => {
                    if (loaded.length > 0 && !loaded.some((m) => m.id === aiModelDraft)) {
                      setAiModelDraft(loaded[0]!.id);
                    }
                  });
                }}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
              >
                {(
                  aiConfig?.providers ?? [
                    { id: 'groq', label: 'Groq (Free Tier — Llama 3.3 70B)' },
                    { id: 'gemini', label: 'Google Gemini (Free Tier — Gemini 2.0 Flash)' },
                    { id: 'openrouter', label: 'OpenRouter (:free models)' },
                    { id: 'ollama', label: 'Ollama (Local Free & Private)' },
                    { id: 'openai', label: 'OpenAI' },
                    { id: 'anthropic', label: 'Anthropic Claude' },
                  ]
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Model ({modelsByProvider[aiProviderDraft]?.length ?? 0}{' '}
                  {modelsSourceByProvider[aiProviderDraft] === 'live' ? 'live' : 'available'})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void loadModelsForProvider(aiProviderDraft, {
                        apiKey: aiApiKeyDraft,
                        baseUrl: aiBaseUrlDraft,
                        model: aiModelDraft,
                      })
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${modelsLoadingProvider === aiProviderDraft ? 'animate-spin' : ''}`}
                    />
                    Load Models
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomModelMode((v) => !v)}
                    className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
                  >
                    {customModelMode ? 'Pick from list' : 'Custom ID'}
                  </button>
                </div>
              </div>
              {customModelMode ? (
                <input
                  type="text"
                  value={aiModelDraft}
                  onChange={(e) => setAiModelDraft(e.target.value)}
                  placeholder={activePreset?.defaultModel || 'llama-3.3-70b-versatile'}
                  className="w-full px-3 py-2 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              ) : (
                <select
                  value={aiModelDraft}
                  onChange={(e) => setAiModelDraft(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                >
                  {aiModelDraft &&
                    !(modelsByProvider[aiProviderDraft] ?? []).some(
                      (m) => m.id === aiModelDraft
                    ) && <option value={aiModelDraft}>{aiModelDraft}</option>}
                  {(modelsByProvider[aiProviderDraft] ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                  {(modelsByProvider[aiProviderDraft]?.length ?? 0) === 0 && !aiModelDraft && (
                    <option value="">
                      {modelsLoadingProvider === aiProviderDraft
                        ? 'Loading models...'
                        : activePreset?.defaultModel || 'Default model'}
                    </option>
                  )}
                </select>
              )}
            </div>
          </div>

          {activePreset?.requiresKey !== false ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  API Key ({activePreset?.envVarName || 'AI_API_KEY'})
                </label>
                {activePreset?.signupUrl && (
                  <a
                    href={activePreset.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                  >
                    Get free key <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="password"
                value={aiApiKeyDraft}
                onChange={(e) => setAiApiKeyDraft(e.target.value)}
                placeholder={
                  aiConfig?.hasApiKey && aiConfig.resolvedProvider === aiProviderDraft
                    ? `Saved: ${aiConfig.maskedKey} (leave blank to keep existing)`
                    : 'Paste your free provider API key (encrypted at rest)'
                }
                className="w-full px-3 py-2 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Local Ollama Base URL
              </label>
              <input
                type="text"
                value={aiBaseUrlDraft}
                onChange={(e) => setAiBaseUrlDraft(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
          )}

          {activePreset && (
            <p className="text-[11px] text-[var(--text-muted)]">{activePreset.notes}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={aiConfigBusy}
              icon={<Key className="w-3.5 h-3.5" />}
            >
              {aiConfigBusy ? 'Saving...' : 'Save AI Config'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={aiConfigBusy}
              onClick={() => void handleTestAiConnection()}
              icon={<Zap className="w-3.5 h-3.5" />}
            >
              Test Connection
            </Button>
            {aiConfig?.source === 'family' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={aiConfigBusy}
                onClick={() => void handleClearAiKey()}
              >
                Clear Saved Key
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
};
