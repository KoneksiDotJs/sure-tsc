import { AiConfigUpdateInput, AiProvider } from '@sure/shared';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { decryptSecret, encryptSecret } from '../../config/crypto.js';
import { env, getLiveEnv } from '../../config/env.js';

export type ResolvedAiProviderId = Exclude<AiProvider, 'auto'>;

export interface ProviderPreset {
  id: ResolvedAiProviderId;
  label: string;
  tier: 'free-cloud' | 'free-local' | 'paid';
  defaultModel: string;
  endpointUrl: string;
  requiresKey: boolean;
  signupUrl: string;
  envVarName: string;
  notes: string;
}

export const AI_PROVIDER_PRESETS: Record<ResolvedAiProviderId, ProviderPreset> = {
  groq: {
    id: 'groq',
    label: 'Groq (Free Tier — Llama 3.3 70B)',
    tier: 'free-cloud',
    defaultModel: 'llama-3.3-70b-versatile',
    endpointUrl: 'https://api.groq.com/openai/v1/chat/completions',
    requiresKey: true,
    signupUrl: 'https://console.groq.com/keys',
    envVarName: 'GROQ_API_KEY',
    notes: 'Free generous daily rate limit, ultra-fast inference.',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini (Free Tier — Gemini 2.0 Flash)',
    tier: 'free-cloud',
    defaultModel: 'gemini-2.0-flash',
    endpointUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    requiresKey: true,
    signupUrl: 'https://aistudio.google.com/apikey',
    envVarName: 'GEMINI_API_KEY',
    notes: 'Free API key via Google AI Studio (OpenAI-compatible endpoint).',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (:free models)',
    tier: 'free-cloud',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
    requiresKey: true,
    signupUrl: 'https://openrouter.ai/keys',
    envVarName: 'OPENROUTER_API_KEY',
    notes: 'Access `:free` community LLMs at $0 cost with an OpenRouter key.',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (Local Free & Private)',
    tier: 'free-local',
    defaultModel: 'llama3.2',
    endpointUrl: 'http://localhost:11434/v1/chat/completions',
    requiresKey: false,
    signupUrl: 'https://ollama.com/download',
    envVarName: 'OLLAMA_BASE_URL',
    notes: 'Runs 100% locally on your machine with zero API key needed.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    tier: 'paid',
    defaultModel: 'gpt-4o-mini',
    endpointUrl: 'https://api.openai.com/v1/chat/completions',
    requiresKey: true,
    signupUrl: 'https://platform.openai.com/api-keys',
    envVarName: 'OPENAI_API_KEY',
    notes: 'Standard OpenAI Chat Completions API.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    tier: 'paid',
    defaultModel: 'claude-3-5-haiku-latest',
    endpointUrl: 'https://api.anthropic.com/v1/messages',
    requiresKey: true,
    signupUrl: 'https://console.anthropic.com/settings/keys',
    envVarName: 'ANTHROPIC_API_KEY',
    notes: 'Anthropic Messages API.',
  },
};

interface StoredFamilyAiConfig {
  provider: AiProvider;
  encryptedApiKey?: string;
  model?: string;
  baseUrl?: string;
  updatedAt: string;
}

const RUNTIME_STORE_PATH = resolve(process.cwd(), 'node_modules/.cache/sure-ai-config.json');
const familyAiCache = new Map<string, StoredFamilyAiConfig>();

function loadPersistedConfigs() {
  if (familyAiCache.size > 0) return;
  try {
    if (!existsSync(RUNTIME_STORE_PATH)) return;
    const raw = readFileSync(RUNTIME_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, StoredFamilyAiConfig>;
    for (const [k, v] of Object.entries(parsed)) {
      familyAiCache.set(k, v);
    }
  } catch {
    // Cache persistence is best-effort
  }
}

function flushPersistedConfigs() {
  try {
    mkdirSync(dirname(RUNTIME_STORE_PATH), { recursive: true });
    const obj: Record<string, StoredFamilyAiConfig> = {};
    for (const [k, v] of familyAiCache.entries()) {
      obj[k] = v;
    }
    writeFileSync(RUNTIME_STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only environments
  }
}

export function maskSecret(secret: string | undefined): string | null {
  if (!secret) return null;
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export interface ResolvedAiRuntime {
  provider: ResolvedAiProviderId;
  model: string;
  endpointUrl: string;
  apiKey?: string;
  source: 'family' | 'env' | 'none';
  preset: ProviderPreset;
}

function getEnvApiKeyForProvider(
  provider: ResolvedAiProviderId,
  liveEnv: ReturnType<typeof getLiveEnv>
): string | undefined {
  switch (provider) {
    case 'groq':
      return (
        liveEnv.GROQ_API_KEY?.trim() ||
        (liveEnv.AI_PROVIDER === 'groq' ? liveEnv.AI_API_KEY?.trim() : undefined)
      );
    case 'gemini':
      return (
        liveEnv.GEMINI_API_KEY?.trim() ||
        (liveEnv.AI_PROVIDER === 'gemini' ? liveEnv.AI_API_KEY?.trim() : undefined)
      );
    case 'openrouter':
      return (
        liveEnv.OPENROUTER_API_KEY?.trim() ||
        (liveEnv.AI_PROVIDER === 'openrouter' ? liveEnv.AI_API_KEY?.trim() : undefined)
      );
    case 'openai':
      return (
        liveEnv.OPENAI_API_KEY?.trim() ||
        (liveEnv.AI_PROVIDER === 'openai' ? liveEnv.AI_API_KEY?.trim() : undefined)
      );
    case 'anthropic':
      return (
        liveEnv.ANTHROPIC_API_KEY?.trim() ||
        (liveEnv.AI_PROVIDER === 'anthropic' ? liveEnv.AI_API_KEY?.trim() : undefined)
      );
    case 'ollama':
      return undefined;
  }
}

export function resolveAiRuntimeConfig(
  familyId?: string,
  override?: Partial<AiConfigUpdateInput>
): ResolvedAiRuntime {
  loadPersistedConfigs();
  const liveEnv = getLiveEnv();
  const familyCfg = familyId ? familyAiCache.get(familyId) : undefined;

  let chosenProvider: AiProvider =
    override?.provider ?? familyCfg?.provider ?? liveEnv.AI_PROVIDER ?? 'auto';
  if (chosenProvider === 'auto') {
    if (liveEnv.AI_API_KEY?.trim() && liveEnv.AI_BASE_URL?.trim()) {
      chosenProvider = 'openai';
    } else if (liveEnv.GROQ_API_KEY?.trim()) {
      chosenProvider = 'groq';
    } else if (liveEnv.GEMINI_API_KEY?.trim()) {
      chosenProvider = 'gemini';
    } else if (liveEnv.OPENROUTER_API_KEY?.trim()) {
      chosenProvider = 'openrouter';
    } else if (liveEnv.OPENAI_API_KEY?.trim()) {
      chosenProvider = 'openai';
    } else if (liveEnv.ANTHROPIC_API_KEY?.trim()) {
      chosenProvider = 'anthropic';
    } else {
      chosenProvider = 'groq';
    }
  }

  const preset = AI_PROVIDER_PRESETS[chosenProvider];
  const familyPlainKey = familyCfg?.encryptedApiKey
    ? decryptSecret(familyCfg.encryptedApiKey)?.trim()
    : undefined;
  const envKey =
    getEnvApiKeyForProvider(chosenProvider, liveEnv) ||
    (liveEnv.AI_PROVIDER === chosenProvider ? liveEnv.AI_API_KEY?.trim() : undefined);

  const overrideKey = override?.apiKey?.trim() || undefined;
  const apiKey = overrideKey || familyPlainKey || envKey || undefined;
  const source: ResolvedAiRuntime['source'] = overrideKey || familyPlainKey
    ? 'family'
    : apiKey
      ? 'env'
      : chosenProvider === 'ollama' &&
          (override?.baseUrl || familyCfg?.baseUrl || liveEnv.OLLAMA_BASE_URL)
        ? override?.baseUrl || familyCfg?.baseUrl
          ? 'family'
          : 'env'
        : 'none';

  const customBase =
    override?.baseUrl?.trim() ||
    familyCfg?.baseUrl?.trim() ||
    liveEnv.AI_BASE_URL?.trim() ||
    (chosenProvider === 'ollama' ? liveEnv.OLLAMA_BASE_URL?.trim() : undefined);
  let endpointUrl = preset.endpointUrl;
  if (customBase) {
    const cleaned = customBase.replace(/\/$/, '');
    endpointUrl =
      cleaned.endsWith('/chat/completions') || cleaned.endsWith('/messages')
        ? cleaned
        : `${cleaned}/v1/chat/completions`;
  }

  const model =
    override?.model?.trim() ||
    familyCfg?.model?.trim() ||
    liveEnv.AI_MODEL?.trim() ||
    preset.defaultModel;

  return {
    provider: chosenProvider,
    model,
    endpointUrl,
    apiKey,
    source,
    preset,
  };
}

export function getSafeAiConfigForFamily(familyId: string) {
  const liveEnv = getLiveEnv();
  const resolved = resolveAiRuntimeConfig(familyId);
  loadPersistedConfigs();
  const stored = familyAiCache.get(familyId);

  return {
    provider: stored?.provider ?? liveEnv.AI_PROVIDER ?? resolved.provider,
    resolvedProvider: resolved.provider,
    model: resolved.model,
    baseUrl:
      stored?.baseUrl ??
      liveEnv.AI_BASE_URL ??
      (resolved.provider === 'ollama' ? liveEnv.OLLAMA_BASE_URL : '') ??
      '',
    hasApiKey: Boolean(resolved.apiKey),
    maskedKey: maskSecret(resolved.apiKey),
    source: resolved.source,
    providers: Object.values(AI_PROVIDER_PRESETS),
  };
}

export function updateFamilyAiConfig(familyId: string, input: AiConfigUpdateInput) {
  loadPersistedConfigs();
  const prev = familyAiCache.get(familyId);

  let nextEncryptedKey = prev?.encryptedApiKey;
  if (input.clearApiKey) {
    nextEncryptedKey = undefined;
  } else if (input.apiKey && input.apiKey.trim().length > 0) {
    nextEncryptedKey = encryptSecret(input.apiKey.trim());
  }

  familyAiCache.set(familyId, {
    provider: input.provider,
    encryptedApiKey: nextEncryptedKey,
    model: input.model?.trim() || undefined,
    baseUrl: input.baseUrl?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  });
  flushPersistedConfigs();

  return getSafeAiConfigForFamily(familyId);
}

export async function invokeAiCompletion(params: {
  runtime: ResolvedAiRuntime;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{
  text: string;
  provider: ResolvedAiProviderId;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}> {
  const { runtime, systemPrompt, userPrompt } = params;

  if (runtime.preset.requiresKey && !runtime.apiKey) {
    throw new Error(
      `No API key configured for ${runtime.preset.label}. Get a free key at ${runtime.preset.signupUrl} or configure Ollama locally.`
    );
  }

  if (runtime.provider === 'anthropic') {
    const res = await fetch(runtime.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': runtime.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: runtime.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errBody.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = json.content?.map((c) => c.text ?? '').join('\n').trim() || '';
    return {
      text,
      provider: runtime.provider,
      model: runtime.model,
      usage: {
        promptTokens: json.usage?.input_tokens ?? 0,
        completionTokens: json.usage?.output_tokens ?? 0,
      },
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (runtime.apiKey) {
    headers.Authorization = `Bearer ${runtime.apiKey}`;
  }
  if (runtime.provider === 'openrouter') {
    headers['HTTP-Referer'] = env.CORS_ORIGIN || 'http://localhost:5173';
    headers['X-Title'] = 'Sure Personal Finance';
  }

  const res = await fetch(runtime.endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: runtime.model,
      temperature: 0.2,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${runtime.preset.label} error (${res.status}): ${errBody.slice(0, 220)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const msg = json.choices?.[0]?.message;
  const text = (msg?.content?.trim() || msg?.reasoning?.trim() || '');
  if (!text) {
    throw new Error(`${runtime.preset.label} returned an empty response`);
  }

  return {
    text,
    provider: runtime.provider,
    model: runtime.model,
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    },
  };
}

export interface AiModelOption {
  id: string;
  name: string;
  isFree: boolean;
  contextLength?: number;
}

const CURATED_PROVIDER_MODELS: Record<ResolvedAiProviderId, AiModelOption[]> = {
  openrouter: [
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Llama 3.3 70B Instruct (Free)',
      isFree: true,
      contextLength: 131072,
    },
    {
      id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      name: 'NVIDIA Nemotron 3 Ultra (Free)',
      isFree: true,
      contextLength: 131072,
    },
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Google Gemini 2.0 Flash Exp (Free)',
      isFree: true,
      contextLength: 1048576,
    },
    {
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek R1 (Free)',
      isFree: true,
      contextLength: 163840,
    },
    {
      id: 'qwen/qwen-2.5-72b-instruct:free',
      name: 'Qwen 2.5 72B Instruct (Free)',
      isFree: true,
      contextLength: 32768,
    },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', isFree: true },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', isFree: true },
    { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B', isFree: true },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', isFree: true },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', isFree: true },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isFree: true },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', isFree: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', isFree: true },
    { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash Preview', isFree: true },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2 (Local)', isFree: true },
    { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B (Local)', isFree: true },
    { id: 'mistral', name: 'Mistral 7B (Local)', isFree: true },
    { id: 'gemma2', name: 'Gemma 2 (Local)', isFree: true },
    { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B (Local)', isFree: true },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', isFree: false },
    { id: 'gpt-4o', name: 'GPT-4o', isFree: false },
    { id: 'o3-mini', name: 'o3-mini', isFree: false },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', isFree: false },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', isFree: false },
    { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4', isFree: false },
  ],
};

function mergeWithCurrentModel(
  models: AiModelOption[],
  currentModel?: string
): AiModelOption[] {
  const seen = new Set<string>();
  const out: AiModelOption[] = [];
  if (currentModel && currentModel.trim()) {
    const id = currentModel.trim();
    const existing = models.find((m) => m.id === id);
    if (existing) {
      out.push(existing);
      seen.add(id);
    } else {
      out.push({
        id,
        name: id,
        isFree: id.endsWith(':free'),
      });
      seen.add(id);
    }
  }
  for (const m of models) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

export async function fetchProviderModels(
  familyId?: string,
  override?: Partial<AiConfigUpdateInput>
): Promise<{
  provider: ResolvedAiProviderId;
  source: 'live' | 'curated';
  models: AiModelOption[];
}> {
  const runtime = resolveAiRuntimeConfig(familyId, override);
  const curated = CURATED_PROVIDER_MODELS[runtime.provider] ?? [];

  try {
    if (runtime.provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: Array<{
            id: string;
            name?: string;
            context_length?: number;
            pricing?: { prompt?: string; completion?: string };
          }>;
        };
        const raw = json.data ?? [];
        const mapped: AiModelOption[] = raw.map((m) => {
          const isFree =
            m.id.endsWith(':free') ||
            (m.pricing?.prompt === '0' && m.pricing?.completion === '0');
          return {
            id: m.id,
            name: m.name ? (isFree ? `${m.name} (Free)` : m.name) : m.id,
            isFree,
            contextLength: m.context_length,
          };
        });
        const freeModels = mapped.filter((m) => m.isFree);
        const paidSample = mapped.filter((m) => !m.isFree).slice(0, 40);
        const combined = [...freeModels, ...paidSample];
        if (combined.length > 0) {
          return {
            provider: 'openrouter',
            source: 'live',
            models: mergeWithCurrentModel(combined, override?.model || runtime.model),
          };
        }
      }
    }

    if (runtime.provider === 'groq' && runtime.apiKey) {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${runtime.apiKey}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: Array<{ id: string; context_window?: number }>;
        };
        const live = (json.data ?? [])
          .filter((m) => !m.id.includes('whisper'))
          .map((m) => ({
            id: m.id,
            name: m.id,
            isFree: true,
            contextLength: m.context_window,
          }));
        if (live.length > 0) {
          return {
            provider: 'groq',
            source: 'live',
            models: mergeWithCurrentModel(live, override?.model || runtime.model),
          };
        }
      }
    }

    if (runtime.provider === 'gemini' && runtime.apiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(runtime.apiKey)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          models?: Array<{
            name: string;
            displayName?: string;
            inputTokenLimit?: number;
            supportedGenerationMethods?: string[];
          }>;
        };
        const live = (json.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => {
            const shortId = m.name.replace(/^models\//, '');
            return {
              id: shortId,
              name: m.displayName || shortId,
              isFree: true,
              contextLength: m.inputTokenLimit,
            };
          });
        if (live.length > 0) {
          return {
            provider: 'gemini',
            source: 'live',
            models: mergeWithCurrentModel(live, override?.model || runtime.model),
          };
        }
      }
    }

    if (runtime.provider === 'ollama') {
      const base = runtime.endpointUrl.replace(/\/v1\/chat\/completions$/, '');
      const res = await fetch(`${base}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          models?: Array<{ name: string }>;
        };
        const live = (json.models ?? []).map((m) => ({
          id: m.name,
          name: `${m.name} (Local)`,
          isFree: true,
        }));
        if (live.length > 0) {
          return {
            provider: 'ollama',
            source: 'live',
            models: mergeWithCurrentModel(live, override?.model || runtime.model),
          };
        }
      }
    }

    if (runtime.provider === 'openai' && runtime.apiKey) {
      const base = runtime.endpointUrl.replace(/\/chat\/completions$/, '');
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${runtime.apiKey}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ id: string }> };
        const live = (json.data ?? [])
          .filter((m) => /^(gpt|o1|o3|o4)/.test(m.id))
          .slice(0, 40)
          .map((m) => ({
            id: m.id,
            name: m.id,
            isFree: false,
          }));
        if (live.length > 0) {
          return {
            provider: 'openai',
            source: 'live',
            models: mergeWithCurrentModel(live, override?.model || runtime.model),
          };
        }
      }
    }

    if (runtime.provider === 'anthropic' && runtime.apiKey) {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': runtime.apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: Array<{ id: string; display_name?: string }>;
        };
        const live = (json.data ?? []).map((m) => ({
          id: m.id,
          name: m.display_name || m.id,
          isFree: false,
        }));
        if (live.length > 0) {
          return {
            provider: 'anthropic',
            source: 'live',
            models: mergeWithCurrentModel(live, override?.model || runtime.model),
          };
        }
      }
    }
  } catch {
    // Graceful fallback to curated provider list
  }

  return {
    provider: runtime.provider,
    source: 'curated',
    models: mergeWithCurrentModel(curated, override?.model || runtime.model),
  };
}

