import { AiConfigUpdateInput, AiProvider } from '@sure/shared';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { decryptSecret, encryptSecret } from '../../config/crypto.js';
import { getLiveEnv } from '../../config/env.js';
import {
  AI_PROVIDER_PRESETS,
  type ProviderPreset,
  type ResolvedAiProviderId,
} from './ai.presets.js';

interface StoredFamilyAiConfig {
  provider: AiProvider;
  encryptedApiKey?: string;
  model?: string;
  baseUrl?: string;
  updatedAt: string;
}

export interface ResolvedAiRuntime {
  provider: ResolvedAiProviderId;
  model: string;
  endpointUrl: string;
  apiKey?: string;
  source: 'family' | 'env' | 'none';
  preset: ProviderPreset;
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

function getEnvApiKeyForProvider(
  provider: ResolvedAiProviderId,
  liveEnv: ReturnType<typeof getLiveEnv>
): string | undefined {
  const genericMatch = liveEnv.AI_PROVIDER === provider ? liveEnv.AI_API_KEY?.trim() : undefined;
  switch (provider) {
    case 'groq':
      return liveEnv.GROQ_API_KEY?.trim() || genericMatch;
    case 'gemini':
      return liveEnv.GEMINI_API_KEY?.trim() || genericMatch;
    case 'openrouter':
      return liveEnv.OPENROUTER_API_KEY?.trim() || genericMatch;
    case 'openai':
      return liveEnv.OPENAI_API_KEY?.trim() || genericMatch;
    case 'anthropic':
      return liveEnv.ANTHROPIC_API_KEY?.trim() || genericMatch;
    case 'ollama':
      return undefined;
  }
}

function resolveAutoProvider(liveEnv: ReturnType<typeof getLiveEnv>): ResolvedAiProviderId {
  if (liveEnv.AI_API_KEY?.trim() && liveEnv.AI_BASE_URL?.trim()) return 'openai';
  if (liveEnv.GROQ_API_KEY?.trim()) return 'groq';
  if (liveEnv.GEMINI_API_KEY?.trim()) return 'gemini';
  if (liveEnv.OPENROUTER_API_KEY?.trim()) return 'openrouter';
  if (liveEnv.OPENAI_API_KEY?.trim()) return 'openai';
  if (liveEnv.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  return 'groq';
}

export function resolveAiRuntimeConfig(
  familyId?: string,
  override?: Partial<AiConfigUpdateInput>
): ResolvedAiRuntime {
  loadPersistedConfigs();
  const liveEnv = getLiveEnv();
  const familyCfg = familyId ? familyAiCache.get(familyId) : undefined;

  const rawProvider: AiProvider =
    override?.provider ?? familyCfg?.provider ?? liveEnv.AI_PROVIDER ?? 'auto';
  const chosenProvider =
    rawProvider === 'auto' ? resolveAutoProvider(liveEnv) : rawProvider;

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
