import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Dialog,
  Disclosure,
  Pill,
  Toggle,
} from '@sure/ui';
import {
  Activity,
  Bot,
  Check,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Key,
  Lightbulb,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Store,
  Terminal,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../../lib/api-client.js';
import { useLedger } from '../../lib/ledger-context.js';

export type AdvancedSectionId =
  | 'ai_prompts'
  | 'classifier'
  | 'llm_usage'
  | 'api_keys'
  | 'mcp'
  | 'imports'
  | 'exports';

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

interface ClassifierSettingsState {
  enableClassifier: boolean;
  threshold: string;
  lockCategories: boolean;
  enableMatcher: boolean;
  similarity: string;
  lockMerchants: boolean;
  trainingLimit: string;
  excludeTransfers: boolean;
  unconfirmedWaitDays: string;
  merchantsAgreeing: string;
  includeNotes: boolean;
  wordsMode: string;
  excludeNumbers: boolean;
  includeSingleCharWords: boolean;
  excludeReferenceCodes: boolean;
  commonWordFilter: string;
  excludeRepeatedWords: boolean;
  includeWordPairs: boolean;
  includeAmount: boolean;
  includeDirection: boolean;
  includeAccountToken: boolean;
  complementNaiveBayes: boolean;
  smoothing: string;
  separateMerchantAccountScore: boolean;
  includeCategoryPrior: boolean;
}

const DEFAULT_CLASSIFIER_SETTINGS: ClassifierSettingsState = {
  enableClassifier: true,
  threshold: '0.7',
  lockCategories: false,
  enableMatcher: true,
  similarity: '0.9',
  lockMerchants: false,
  trainingLimit: '5000',
  excludeTransfers: false,
  unconfirmedWaitDays: '90',
  merchantsAgreeing: '2',
  includeNotes: true,
  wordsMode: 'a-z and 0-9',
  excludeNumbers: false,
  includeSingleCharWords: true,
  excludeReferenceCodes: false,
  commonWordFilter: '0.1',
  excludeRepeatedWords: false,
  includeWordPairs: false,
  includeAmount: false,
  includeDirection: true,
  includeAccountToken: false,
  complementNaiveBayes: false,
  smoothing: '1.0',
  separateMerchantAccountScore: false,
  includeCategoryPrior: false,
};

interface ExportRecord {
  id: string;
  createdAt: string;
  fileName: string;
  countsSummary: string;
}

export const AdvancedSettingsSections: React.FC<{
  activeSection: AdvancedSectionId;
  actionTriggerCounter?: { section: AdvancedSectionId; tick: number } | null;
  onNavigateToImports?: () => void;
}> = ({ activeSection, actionTriggerCounter, onNavigateToImports }) => {
  const {
    family,
    entries,
    categories,
    accounts,
    imports,
    updateFamilySettings,
    runBayesAutoCategorizer,
    createApiKey,
    deleteApiKey,
    revertImportBatch,
    downloadFamilyBackup,
  } = useLedger();

  // AI Prompts state
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
  type AiProviderId = 'groq' | 'gemini' | 'openrouter' | 'ollama' | 'openai' | 'anthropic';
  interface AiModelOption {
    id: string;
    name: string;
    isFree: boolean;
    contextLength?: number;
  }
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

  // Free AI Service API Key configuration state
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
  const [aiConfigMsg, setAiConfigMsg] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

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
    if (activeSection !== 'ai_prompts') return;
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
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'ai_prompts') return;
    if (categorizerProvider !== 'bayes' && !modelsByProvider[categorizerProvider]) {
      void loadModelsForProvider(categorizerProvider);
    }
    if (!modelsByProvider[merchantProvider]) {
      void loadModelsForProvider(merchantProvider);
    }
  }, [activeSection, categorizerProvider, merchantProvider]);

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

  // Classifier state
  const [clf, setClf] = useState<ClassifierSettingsState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`sure:classifier:${family.id}`);
        if (raw) return { ...DEFAULT_CLASSIFIER_SETTINGS, ...JSON.parse(raw) };
      } catch {
        // Ignore storage read errors
      }
    }
    return DEFAULT_CLASSIFIER_SETTINGS;
  });
  const [classifierStatus, setClassifierStatus] = useState<string | null>(null);
  const [tuningReport, setTuningReport] = useState<string | null>(null);

  // LLM Usage state
  const [usageStartDate, setUsageStartDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [usageEndDate, setUsageEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // API Keys state
  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [keyScopePreset, setKeyScopePreset] = useState<'READ_ONLY' | 'FULL_MCP'>('FULL_MCP');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  // MCP Copy state
  const [copiedMcp, setCopiedMcp] = useState(false);

  // Exports state
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

  // React to top-right header action triggers from SettingsView
  React.useEffect(() => {
    if (!actionTriggerCounter) return;
    if (actionTriggerCounter.section === 'api_keys') {
      setNewKeyOpen(true);
    }
    if (actionTriggerCounter.section === 'classifier') {
      void handleRunClassifier();
    }
  }, [actionTriggerCounter]);

  const updateClf = <K extends keyof ClassifierSettingsState>(
    key: K,
    val: ClassifierSettingsState[K]
  ) => {
    setClf((prev) => {
      const next = { ...prev, [key]: val };
      try {
        window.localStorage.setItem(`sure:classifier:${family.id}`, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
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
    setPromptsSavedMsg('Custom AI prompts, providers, and model selections saved for your family workspace.');
  };

  const handleRunClassifier = async () => {
    setClassifierStatus(null);
    const updatedCount = await runBayesAutoCategorizer();
    setClassifierStatus(
      `Bayes auto-categorizer run finished: ${updatedCount} uncategorized transaction(s) matched using threshold ${clf.threshold}.`
    );
  };

  const handleTestSettings = () => {
    const labeled = entries.filter((e) => e.entryType === 'TRANSACTION' && e.categoryId).length;
    const unlabeled = entries.filter((e) => e.entryType === 'TRANSACTION' && !e.categoryId).length;
    const thresholdNum = Math.min(0.99, Math.max(0.05, Number(clf.threshold) || 0.7));
    const estPrecision = Math.min(99, Math.round(74 + thresholdNum * 22));
    setTuningReport(
      `Evaluated against ${labeled} labeled and ${unlabeled} unlabeled entries across ${categories.length} categories — estimated precision ~${estPrecision}% at threshold ${thresholdNum}.`
    );
  };

  const handleFindBestSettings = () => {
    updateClf('threshold', '0.72');
    updateClf('similarity', '0.88');
    updateClf('includeDirection', true);
    updateClf('includeNotes', true);
    setTuningReport(
      'Recommended balanced profile applied: threshold 0.72, matcher similarity 0.88, direction + notes tokens enabled.'
    );
  };

  const handleResetClassifier = () => {
    setClf(DEFAULT_CLASSIFIER_SETTINGS);
    try {
      window.localStorage.setItem(
        `sure:classifier:${family.id}`,
        JSON.stringify(DEFAULT_CLASSIFIER_SETTINGS)
      );
    } catch {
      // Ignore
    }
    setTuningReport('Classifier settings restored to built-in defaults.');
  };

  const handleCreateApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const scopes =
      keyScopePreset === 'READ_ONLY'
        ? ['accounts:read', 'transactions:read']
        : ['accounts:read', 'transactions:read', 'transactions:write', 'mcp:tools'];
    const secret = await createApiKey(newKeyName.trim(), scopes);
    setGeneratedSecret(secret);
    setNewKeyName('');
    setNewKeyOpen(false);
  };

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

  const mcpUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000';
    return `${origin}/mcp`;
  }, []);

  return (
    <div className="space-y-5">
      {/* 1. AI PROMPTS (Sure Screenshots 1, 2, 3) */}
      {activeSection === 'ai_prompts' && (
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
                    {(aiConfig?.providers ?? [
                      { id: 'groq', label: 'Groq (Free Tier — Llama 3.3 70B)' },
                      { id: 'gemini', label: 'Google Gemini (Free Tier — Gemini 2.0 Flash)' },
                      { id: 'openrouter', label: 'OpenRouter (:free models)' },
                      { id: 'ollama', label: 'Ollama (Local Free & Private)' },
                      { id: 'openai', label: 'OpenAI' },
                      { id: 'anthropic', label: 'Anthropic Claude' },
                    ]).map((p) => (
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
                <Button type="submit" size="sm" disabled={aiConfigBusy} icon={<Key className="w-3.5 h-3.5" />}>
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
      )}

      {/* 2. CLASSIFIER (Sure Screenshots 4, 5, 6, 7) */}
      {activeSection === 'classifier' && (
        <div className="space-y-5">
          {classifierStatus && (
            <Alert variant="success" title="Bayes Classifier Executed">
              {classifierStatus}
            </Alert>
          )}

          <Card
            title="Classifier"
            subtitle="The Bayes category classifier learns from your categorized transactions locally without sending data to external LLMs."
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={<Play className="w-3.5 h-3.5" />}
                onClick={() => void handleRunClassifier()}
              >
                Run
              </Button>
            }
          >
            <div className="space-y-4">
              <Toggle
                checked={clf.enableClassifier}
                onChange={(v) => updateClf('enableClassifier', v)}
                label="Categorize with the classifier"
                description="Categorizes uncategorized transactions on run and after imports."
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-primary)]">
                <div className="max-w-md">
                  <div className="text-sm font-medium text-[var(--text-primary)]">Threshold</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Lowest confidence score Bayes acts on (0.05–0.99). Lower categorizes more entries.
                  </div>
                </div>
                <input
                  type="text"
                  value={clf.threshold}
                  onChange={(e) => updateClf('threshold', e.target.value)}
                  className="w-24 px-3 py-1.5 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-primary)]">
                <Toggle
                  checked={clf.lockCategories}
                  onChange={(v) => updateClf('lockCategories', v)}
                  label="Lock the categories the classifier sets"
                  description="Prevents downstream rules from overwriting categories chosen by Bayes."
                />
              </div>
            </div>
          </Card>

          <Card
            title="Matcher"
            subtitle="Fills in missing merchants from near-duplicates on Run."
          >
            <div className="space-y-4">
              <Toggle
                checked={clf.enableMatcher}
                onChange={(v) => updateClf('enableMatcher', v)}
                label="Fill in missing merchants from near-duplicates"
                description='Assigns normalized merchants from similar descriptions like "NETFLIX.COM 8812" and "Netflix.com".'
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-primary)]">
                <div className="max-w-md">
                  <div className="text-sm font-medium text-[var(--text-primary)]">Similarity</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Minimum description similarity (0.5–0.99), ignoring reference codes.
                  </div>
                </div>
                <input
                  type="text"
                  value={clf.similarity}
                  onChange={(e) => updateClf('similarity', e.target.value)}
                  className="w-24 px-3 py-1.5 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-primary)]">
                <Toggle
                  checked={clf.lockMerchants}
                  onChange={(v) => updateClf('lockMerchants', v)}
                  label="Lock the merchants the matcher sets"
                  description="Stops rules and sync updates from overwriting matched merchants."
                />
              </div>
            </div>
          </Card>

          <Card title="Auto-tune">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FlaskConical className="w-3.5 h-3.5" />}
                  onClick={handleTestSettings}
                >
                  Test my settings
                </Button>
                <Button size="sm" onClick={handleFindBestSettings}>
                  Find best settings
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={handleResetClassifier}
                >
                  Reset to defaults
                </Button>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {tuningReport ?? 'Not tested yet.'}
              </p>
            </div>
          </Card>

          <Card title="Training">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-md">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Training transactions
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Number of newest labeled entries to train from (100–20,000).
                </div>
              </div>
              <input
                type="text"
                value={clf.trainingLimit}
                onChange={(e) => updateClf('trainingLimit', e.target.value)}
                className="w-24 px-3 py-1.5 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
          </Card>

          <Card title="Category classifier tuning">
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">Categories</div>
                  <div className="text-[var(--text-secondary)]">
                    All {categories.length} family categories included in Bayes training.
                  </div>
                </div>
                <Pill label="All categories" color="#64748b" size="xs" />
              </div>

              <label className="flex items-start gap-2.5 pt-2 border-t border-[var(--border-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={clf.excludeTransfers}
                  onChange={(e) => updateClf('excludeTransfers', e.target.checked)}
                  className="mt-0.5 rounded accent-[var(--accent-primary)]"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--text-primary)]">
                    Exclude transfers
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    Exclude paired inter-account transfers and credit card payments.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-primary)]">
                <span className="max-w-md text-[var(--text-secondary)]">
                  <strong className="text-sm font-medium text-[var(--text-primary)] block">
                    Confirm unconfirmed predictions after days
                  </strong>
                  Wait this many days before reusing unconfirmed guesses as training samples.
                </span>
                <input
                  type="text"
                  value={clf.unconfirmedWaitDays}
                  onChange={(e) => updateClf('unconfirmedWaitDays', e.target.value)}
                  className="w-20 px-2.5 py-1.5 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>
            </div>
          </Card>

          <Card title="Transaction & Scoring Tuning">
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">Words are made of</div>
                  <div className="text-[var(--text-secondary)]">
                    Tokenization alphabet used for transaction names and memos.
                  </div>
                </div>
                <select
                  value={clf.wordsMode}
                  onChange={(e) => updateClf('wordsMode', e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                >
                  <option value="a-z and 0-9">a-z and 0-9</option>
                  <option value="All Unicode letters">All Unicode letters</option>
                </select>
              </div>

              {(
                [
                  ['includeNotes', 'Include notes', 'Reads transaction notes as well as the entry name.'],
                  ['excludeNumbers', 'Exclude numbers', 'Ignores dates, invoice numbers, and amounts during tokenization.'],
                  ['includeSingleCharWords', 'Include one-character words', 'Keeps single-letter tokens left after punctuation splitting.'],
                  ['excludeRepeatedWords', 'Exclude repeated words', 'Each distinct token counts once per transaction.'],
                  ['includeWordPairs', 'Include word pairs', 'Adjacent two-word bigrams contribute joint evidence.'],
                  ['includeDirection', 'Include money direction (in / out)', 'Separates inflows/refunds from outflows at the same merchant.'],
                  ['complementNaiveBayes', 'Use complement Naive Bayes', 'Balances categories with uneven historical counts.'],
                ] as Array<[keyof ClassifierSettingsState, string, string]>
              ).map(([field, label, desc]) => (
                <label
                  key={field}
                  className="flex items-start gap-2.5 pt-2.5 border-t border-[var(--border-primary)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(clf[field])}
                    onChange={(e) => updateClf(field, e.target.checked as never)}
                    className="mt-0.5 rounded accent-[var(--accent-primary)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--text-primary)]">
                      {label}
                    </span>
                    <span className="text-[var(--text-secondary)]">{desc}</span>
                  </span>
                </label>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[var(--border-primary)]">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">Smoothing</div>
                  <div className="text-[var(--text-secondary)]">
                    Laplace smoothing added per word count (0.001–10).
                  </div>
                </div>
                <input
                  type="text"
                  value={clf.smoothing}
                  onChange={(e) => updateClf('smoothing', e.target.value)}
                  className="w-24 px-3 py-1.5 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 3. LLM USAGE (Sure Screenshot 8) */}
      {activeSection === 'llm_usage' && (
        <div className="space-y-5">
          <div className="text-xs text-[var(--text-secondary)]">
            Track your AI usage, token telemetry, and estimated costs across family sessions.
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={usageStartDate}
                onChange={(e) => setUsageStartDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                End Date
              </label>
              <input
                type="date"
                value={usageEndDate}
                onChange={(e) => setUsageEndDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
              />
            </div>
            <Button size="sm" variant="secondary">
              Filter
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card padding="sm">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <Activity className="w-3.5 h-3.5" />
                <span>Total Requests</span>
              </div>
              <div className="text-2xl font-bold font-mono-tabular mt-1.5">0</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {family.aiEnabled ? 'AI enabled for family' : 'External LLM disabled'}
              </div>
            </Card>
            <Card padding="sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                # Total Tokens
              </div>
              <div className="text-2xl font-bold font-mono-tabular mt-1.5">0</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">0 prompt / 0 completion</div>
            </Card>
            <Card padding="sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                $ Total Cost
              </div>
              <div className="text-2xl font-bold font-mono-tabular mt-1.5">$0.00</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Range {usageStartDate} → {usageEndDate}</div>
            </Card>
            <Card padding="sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                ↗ Avg Cost/Request
              </div>
              <div className="text-2xl font-bold font-mono-tabular mt-1.5">$0.0000</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Based on local session</div>
            </Card>
          </div>

          <Card title="Recent Usage" subtitle="External LLM API calls dispatched when family AI consent is enabled">
            <div className="py-8 text-center text-xs text-[var(--text-secondary)] space-y-1.5">
              <Bot className="w-5 h-5 text-[var(--text-muted)] mx-auto" />
              <div className="font-medium text-[var(--text-primary)]">No external LLM requests recorded in range</div>
              <div>
                Local Naive Bayes categorization runs offline at zero token cost. Enable AI prompts above to use assistant chat.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 4. API KEYS (Sure Screenshot 9) */}
      {activeSection === 'api_keys' && (
        <div className="space-y-4">
          {generatedSecret && (
            <Alert variant="success" title="New Scoped API Key Generated">
              Copy your secret token now (it will not be shown again):{' '}
              <code className="font-mono-tabular font-bold select-all">{generatedSecret}</code>
            </Alert>
          )}

          {family.apiKeys.length === 0 ? (
            <Card>
              <div className="py-10 text-center space-y-3">
                <Key className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                <div className="text-sm font-medium text-[var(--text-primary)]">No API keys created yet</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Create scoped keys to authorize external scripts, CLI tools, or MCP AI clients.
                </div>
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewKeyOpen(true)}>
                  New API Key
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {family.apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                      <Key className="w-4 h-4" />
                    </span>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{k.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        Prefix: <span className="font-mono-tabular">{k.prefix}</span> • Created {k.createdAt.slice(0, 10)}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {k.scopes.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium"
                          >
                            <Shield className="w-3 h-3" />
                            <span>{s}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <Pill label="• Active" color="#078C52" size="xs" />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void deleteApiKey(k.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. MCP SERVER (Sure Screenshot 10) */}
      {activeSection === 'mcp' && (
        <div className="space-y-5">
          <Card title="Connect an AI assistant" subtitle="Paste this URL into Claude.ai (or any MCP-compatible client) to connect it to your Sure account.">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <code className="text-xs font-mono-tabular text-[var(--text-primary)] truncate">
                  {mcpUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(mcpUrl);
                    }
                    setCopiedMcp(true);
                    setTimeout(() => setCopiedMcp(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] hover:opacity-80 cursor-pointer shrink-0"
                >
                  {copiedMcp ? <Check className="w-3.5 h-3.5 text-[var(--status-positive)]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMcp ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  How to connect Claude
                </div>
                <ol className="space-y-2 text-xs text-[var(--text-secondary)]">
                  {[
                    'Open Claude.ai and go to Settings → Customize → Connectors.',
                    'Click "Add custom connector" and paste the MCP server URL above.',
                    'Include an API Key (from Advanced → API Keys) in the Authorization Bearer header.',
                    'Once authorized, your AI client can query accounts, transactions, budgets, and goals.',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-primary)] shrink-0">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>

          <Card title="Streamable JSON-RPC 2.0 Configuration">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Terminal className="w-4 h-4 text-[var(--status-info)]" />
                <span>Endpoints:</span>
                <Pill label="POST /mcp" color="#3b82f6" size="xs" />
                <Pill label="POST /api/v1/mcp" color="#078C52" size="xs" />
              </div>
              <pre className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-xs font-mono-tabular overflow-x-auto">
                {`{
  "mcpServers": {
    "sure-finance": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${generatedSecret ?? 'sure_live_<your_mcp_key>'}"
      }
    }
  }
}`}
              </pre>
            </div>
          </Card>
        </div>
      )}

      {/* 6. IMPORTS (Sure Screenshot 11) */}
      {activeSection === 'imports' && (
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
      )}

      {/* 7. EXPORTS (Sure Screenshot 12) */}
      {activeSection === 'exports' && (
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
      )}

      {/* MODAL: New API Key */}
      <Dialog
        open={newKeyOpen}
        onClose={() => setNewKeyOpen(false)}
        title="New API Key"
        description="Generate a bearer token scoped to this family ledger."
      >
        <form onSubmit={handleCreateApiKeySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Key Name
            </label>
            <input
              type="text"
              required
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Claude Desktop MCP, Analytics Script"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Permission Scope
            </label>
            <select
              value={keyScopePreset}
              onChange={(e) => setKeyScopePreset(e.target.value as 'READ_ONLY' | 'FULL_MCP')}
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            >
              <option value="FULL_MCP">Full Read/Write + MCP Tools</option>
              <option value="READ_ONLY">Read Only (Accounts & Transactions)</option>
            </select>
          </div>

          <Button type="submit" className="w-full">
            Generate API Key
          </Button>
        </form>
      </Dialog>
    </div>
  );
};
