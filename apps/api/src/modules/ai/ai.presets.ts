import { AiProvider } from '@sure/shared';

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

export interface AiModelOption {
  id: string;
  name: string;
  isFree: boolean;
  contextLength?: number;
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

export const CURATED_PROVIDER_MODELS: Record<ResolvedAiProviderId, AiModelOption[]> = {
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
