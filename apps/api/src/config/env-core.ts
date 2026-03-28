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

function envInteger<T extends z.ZodNumber>(schema: T, defaultValue?: number) {
  return z.preprocess((value) => {
    if (value === undefined) {
      return defaultValue !== undefined ? defaultValue : value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();

      if (normalized.length === 0) {
        return defaultValue !== undefined ? defaultValue : value;
      }

      if (/^-?\d+$/.test(normalized)) {
        return Number(normalized);
      }
    }

    return value;
  }, schema);
}

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: envInteger(z.number().int().min(0).max(65535), 4000),
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: envBoolean(false),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  CORS_ALLOW_CREDENTIALS: envBoolean(false),
  API_RATE_LIMIT_MAX: envInteger(z.number().int().min(1), 120),
  API_RATE_LIMIT_WINDOW_MS: envInteger(z.number().int().min(1000), 60000),
  API_RATE_LIMIT_ALLOWLIST: z.string().default('127.0.0.1,::1'),
  ALERT_WEBHOOK_URL: z.string().default(''),
  ALERT_WEBHOOK_AUTH_TOKEN: z.string().default(''),
  PLATFORM_DOMAIN: z.string().default('platform.local'),
  CADDY_ADMIN_URL: z.string().url().default('http://localhost:2019'),
  PROJECT_DOMAIN_DIAGNOSTICS_REFRESH_INTERVAL_MS: envInteger(z.number().int().min(1000), 300000),
  PROJECT_DOMAIN_DIAGNOSTICS_STALE_MS: envInteger(z.number().int().min(1000), 1800000),
  PROJECT_DOMAIN_DIAGNOSTICS_BATCH_SIZE: envInteger(z.number().int().min(1), 10),
  INVITATION_CLAIM_BASE_URL: z.string().url().default('http://platform.example.com'),
  INVITATION_DELIVERY_WEBHOOK_URL: z.string().default(''),
  INVITATION_DELIVERY_WEBHOOK_AUTH_TOKEN: z.string().default(''),
  ALERT_MONITOR_INTERVAL_MS: envInteger(z.number().int().min(5000), 30000),
  ALERT_COOLDOWN_MS: envInteger(z.number().int().min(1000), 300000),
  ALERT_QUEUE_WAITING_THRESHOLD: envInteger(z.number().int().min(1), 50),
  ALERT_QUEUE_ACTIVE_THRESHOLD: envInteger(z.number().int().min(1), 20),
  ALERT_QUEUE_FAILED_THRESHOLD: envInteger(z.number().int().min(1), 10),
  DEPLOYMENT_DEFAULT_CONTAINER_PORT: envInteger(z.number().int().min(1).max(65535), 3000),
  DEPLOYMENT_DEFAULT_MEMORY_MB: envInteger(z.number().int().min(64), 512),
  DEPLOYMENT_DEFAULT_CPU_MILLICORES: envInteger(z.number().int().min(100), 500),
  WORKER_HEARTBEAT_KEY: z.string().default('vcloudrunner:worker:heartbeat'),
  WORKER_HEARTBEAT_STALE_MS: envInteger(z.number().int().min(5000), 45000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_TOKENS_JSON: z.string().default(''),
  ENABLE_DEV_AUTH: envBoolean(false),
  DB_POOL_MAX: envInteger(z.number().int().min(1), 20),
  DB_POOL_IDLE_TIMEOUT_MS: envInteger(z.number().int().min(1000), 30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: envInteger(z.number().int().min(1000), 5000),
  DB_POOL_STATEMENT_TIMEOUT_MS: envInteger(z.number().int().min(0), 30000),
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
