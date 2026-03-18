import { z } from 'zod';

const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_ENV_VALUES = new Set(['0', 'false', 'no', 'off', '']);

function envBoolean(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined) {
      return defaultValue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }

      if (value === 0) {
        return false;
      }

      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();

      if (TRUE_ENV_VALUES.has(normalized)) {
        return true;
      }

      if (FALSE_ENV_VALUES.has(normalized)) {
        return false;
      }
    }

    return value;
  }, z.boolean());
}

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: envBoolean(false),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  CORS_ALLOW_CREDENTIALS: envBoolean(false),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  API_RATE_LIMIT_ALLOWLIST: z.string().default('127.0.0.1,::1'),
  ALERT_WEBHOOK_URL: z.string().default(''),
  ALERT_WEBHOOK_AUTH_TOKEN: z.string().default(''),
  ALERT_MONITOR_INTERVAL_MS: z.coerce.number().int().min(5000).default(30000),
  ALERT_COOLDOWN_MS: z.coerce.number().int().min(1000).default(300000),
  ALERT_QUEUE_WAITING_THRESHOLD: z.coerce.number().int().min(1).default(50),
  ALERT_QUEUE_ACTIVE_THRESHOLD: z.coerce.number().int().min(1).default(20),
  ALERT_QUEUE_FAILED_THRESHOLD: z.coerce.number().int().min(1).default(10),
  DEPLOYMENT_DEFAULT_CONTAINER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DEPLOYMENT_DEFAULT_MEMORY_MB: z.coerce.number().int().min(64).default(512),
  DEPLOYMENT_DEFAULT_CPU_MILLICORES: z.coerce.number().int().min(100).default(500),
  WORKER_HEARTBEAT_KEY: z.string().default('vcloudrunner:worker:heartbeat'),
  WORKER_HEARTBEAT_STALE_MS: z.coerce.number().int().min(5000).default(45000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_TOKENS_JSON: z.string().default(''),
  ENABLE_DEV_AUTH: envBoolean(false),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  DB_POOL_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),
  OTEL_ENABLED: envBoolean(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_SERVICE_NAME: z.string().default('vcloudrunner-api')
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): AppEnv {
  return EnvSchema.parse(source);
}

export function assertSafeEnv(config: AppEnv) {
  if (config.NODE_ENV === 'production' && config.ENABLE_DEV_AUTH) {
    throw new Error('Unsafe configuration: ENABLE_DEV_AUTH must be false when NODE_ENV=production');
  }

  if (config.NODE_ENV === 'production' && config.API_TOKENS_JSON.trim().length > 0) {
    throw new Error('Unsafe configuration: API_TOKENS_JSON must be empty when NODE_ENV=production');
  }
}

export function emitStartupWarnings(config: AppEnv, warn: (message: string) => void = console.warn) {
  if (config.ENABLE_DEV_AUTH && config.NODE_ENV === 'development') {
    warn('[vcloudrunner-api] ENABLE_DEV_AUTH is enabled; this bypass is intended for local development only.');
  }

  if (config.API_TOKENS_JSON.trim().length > 0) {
    warn('[vcloudrunner-api] API_TOKENS_JSON static token fallback is enabled; prefer DB-backed tokens for normal operation.');
  }
}
