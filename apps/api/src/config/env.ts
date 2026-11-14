import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const result: Record<string, string> = {};
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

export function loadWorkspaceEnv(forceRefresh = false): Record<string, string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../../../.env'), // c:\project\sure-tsc\.env (from src/config or dist/config)
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ];
  const merged: Record<string, string> = {};
  for (const path of candidates) {
    Object.assign(merged, parseEnvFile(path));
  }
  for (const [key, val] of Object.entries(merged)) {
    if (forceRefresh || process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
  return merged;
}

loadWorkspaceEnv();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgresql://sure:sure_password@localhost:5432/sure_dev?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SESSION_SECRET: z.string().default('sure-super-secret-session-key-minimum-32-chars'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // OAuth 2.0 + PKCE
  OAUTH_REDIRECT_BASE_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // WebAuthn Passkeys
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_RP_NAME: z.string().default('Sure'),
  WEBAUTHN_ORIGIN: z.string().optional(),

  // Password recovery email delivery
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Sure <noreply@sure.local>'),

  // AI Chatbot & LLM Providers
  AI_PROVIDER: z
    .enum(['auto', 'groq', 'gemini', 'openrouter', 'ollama', 'openai', 'anthropic'])
    .default('auto'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);

export function getLiveEnv() {
  if (process.env.NODE_ENV !== 'test') {
    loadWorkspaceEnv(true);
  }
  return EnvSchema.parse(process.env);
}


