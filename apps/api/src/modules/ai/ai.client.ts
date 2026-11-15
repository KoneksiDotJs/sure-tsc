import { AiConfigUpdateInput } from '@sure/shared';
import { env } from '../../config/env.js';
import { resolveAiRuntimeConfig, type ResolvedAiRuntime } from './ai.config.store.js';
import {
  CURATED_PROVIDER_MODELS,
  type AiModelOption,
  type ResolvedAiProviderId,
} from './ai.presets.js';

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
    return invokeAnthropicCompletion(runtime, systemPrompt, userPrompt);
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
  const text = msg?.content?.trim() || msg?.reasoning?.trim() || '';
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

async function invokeAnthropicCompletion(
  runtime: ResolvedAiRuntime,
  systemPrompt: string,
  userPrompt: string
) {
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

function mergeWithCurrentModel(
  models: AiModelOption[],
  currentModel?: string
): AiModelOption[] {
  const seen = new Set<string>();
  const out: AiModelOption[] = [];
  if (currentModel && currentModel.trim()) {
    const id = currentModel.trim();
    const existing = models.find((m) => m.id === id);
    out.push(existing ?? { id, name: id, isFree: id.endsWith(':free') });
    seen.add(id);
  }
  for (const m of models) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

async function fetchLiveModelsForProvider(runtime: ResolvedAiRuntime): Promise<AiModelOption[]> {
  if (runtime.provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
      }>;
    };
    const mapped: AiModelOption[] = (json.data ?? []).map((m) => {
      const isFree =
        m.id.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0');
      return {
        id: m.id,
        name: m.name ? (isFree ? `${m.name} (Free)` : m.name) : m.id,
        isFree,
        contextLength: m.context_length,
      };
    });
    return [...mapped.filter((m) => m.isFree), ...mapped.filter((m) => !m.isFree).slice(0, 40)];
  }

  if (runtime.provider === 'groq' && runtime.apiKey) {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${runtime.apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ id: string; context_window?: number }> };
    return (json.data ?? [])
      .filter((m) => !m.id.includes('whisper'))
      .map((m) => ({ id: m.id, name: m.id, isFree: true, contextLength: m.context_window }));
  }

  if (runtime.provider === 'gemini' && runtime.apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(runtime.apiKey)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        inputTokenLimit?: number;
        supportedGenerationMethods?: string[];
      }>;
    };
    return (json.models ?? [])
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
  }

  if (runtime.provider === 'ollama') {
    const base = runtime.endpointUrl.replace(/\/v1\/chat\/completions$/, '');
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: Array<{ name: string }> };
    return (json.models ?? []).map((m) => ({
      id: m.name,
      name: `${m.name} (Local)`,
      isFree: true,
    }));
  }

  if (runtime.provider === 'openai' && runtime.apiKey) {
    const base = runtime.endpointUrl.replace(/\/chat\/completions$/, '');
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${runtime.apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    return (json.data ?? [])
      .filter((m) => /^(gpt|o1|o3|o4)/.test(m.id))
      .slice(0, 40)
      .map((m) => ({ id: m.id, name: m.id, isFree: false }));
  }

  if (runtime.provider === 'anthropic' && runtime.apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': runtime.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
    return (json.data ?? []).map((m) => ({
      id: m.id,
      name: m.display_name || m.id,
      isFree: false,
    }));
  }

  return [];
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
    const live = await fetchLiveModelsForProvider(runtime);
    if (live.length > 0) {
      return {
        provider: runtime.provider,
        source: 'live',
        models: mergeWithCurrentModel(live, override?.model || runtime.model),
      };
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
