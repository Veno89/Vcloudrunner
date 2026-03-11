import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  DEPLOYMENT_DEFAULT_CONTAINER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DEPLOYMENT_DEFAULT_MEMORY_MB: z.coerce.number().int().min(64).default(512),
  DEPLOYMENT_DEFAULT_CPU_MILLICORES: z.coerce.number().int().min(100).default(500),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_TOKENS_JSON: z.string().default('')
});

export type AppEnv = z.infer<typeof EnvSchema>;

export const env: AppEnv = EnvSchema.parse(process.env);
