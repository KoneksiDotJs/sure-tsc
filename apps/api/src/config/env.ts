import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgresql://sure:sure_password@localhost:5432/sure_dev?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SESSION_SECRET: z.string().default('sure-super-secret-session-key-minimum-32-chars'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
