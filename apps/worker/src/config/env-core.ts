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

export const WorkerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DOCKER_SOCKET_PATH: z.string().default('/var/run/docker.sock'),
  DEPLOYMENT_NETWORK_NAME: z.string().default('vcloudrunner-deployments'),
  PLATFORM_DOCKER_NETWORK_NAME: z.string().default(''),
  DEPLOYMENT_RUNTIME_EXECUTOR: z.enum(['docker']).default('docker'),
  WORK_DIR: z.string().default('.tmp/deployments'),
  PLATFORM_DOMAIN: z.string().default('platform.local'),
  CADDY_ADMIN_URL: z.string().url().default('http://localhost:2019'),
  DEPLOYMENT_DEFAULT_CONTAINER_PORT: envInteger(z.number().int().min(1).max(65535), 3000),
  DEPLOYMENT_DEFAULT_MEMORY_MB: envInteger(z.number().int().min(64), 512),
  DEPLOYMENT_DEFAULT_CPU_MILLICORES: envInteger(z.number().int().min(100), 500),
  DEPLOYMENT_EXECUTION_TIMEOUT_MS: envInteger(z.number().int().min(60000), 1200000),
  DEPLOYMENT_STUCK_RECOVERY_INTERVAL_MS: envInteger(z.number().int().min(60000), 300000),
  DEPLOYMENT_STUCK_QUEUED_MAX_AGE_MINUTES: envInteger(z.number().int().min(1), 30),
  DEPLOYMENT_STUCK_BUILDING_MAX_AGE_MINUTES: envInteger(z.number().int().min(1), 60),
  WORKER_HEARTBEAT_KEY: z.string().default('vcloudrunner:worker:heartbeat'),
  WORKER_HEARTBEAT_INTERVAL_MS: envInteger(z.number().int().min(1000), 10000),
  WORKER_HEARTBEAT_TTL_SECONDS: envInteger(z.number().int().min(5), 45),
  DEPLOYMENT_LOG_RETENTION_DAYS: envInteger(z.number().int().min(1), 14),
  DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT: envInteger(z.number().int().min(100), 2000),
  DEPLOYMENT_LOG_PRUNE_INTERVAL_MS: envInteger(z.number().int().min(60000), 300000),
  DEPLOYMENT_LOG_ARCHIVE_DIR: z.string().default('.tmp/log-archives'),
  DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS: envInteger(z.number().int().min(60000), 3600000),
  DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS: envInteger(z.number().int().min(1), 1),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER: z.enum(['http', 's3', 'gcs', 'azure']).default('http'),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_INTERVAL_MS: envInteger(z.number().int().min(60000), 600000),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS: envInteger(z.number().int().min(1000), 30000),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS: envInteger(z.number().int().min(1), 3),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS: envInteger(z.number().int().min(100), 1000),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS: envInteger(z.number().int().min(100), 30000),
  DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX: z.string().default('archives/deployments'),
  DEPLOYMENT_LOG_ARCHIVE_S3_REGION: z.string().default('us-east-1'),
  DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX: z.string().default('archives/deployments'),
  DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX: z.string().default('archives/deployments'),
  DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD: envBoolean(false),
  DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS: envInteger(z.number().int().min(60000), 3600000),
  DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS: envInteger(z.number().int().min(1), 30),
  DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS: envInteger(z.number().int().min(1), 90),
  DB_POOL_MAX: envInteger(z.number().int().min(1), 10),
  DB_POOL_IDLE_TIMEOUT_MS: envInteger(z.number().int().min(1000), 30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: envInteger(z.number().int().min(1000), 5000),
  DB_POOL_STATEMENT_TIMEOUT_MS: envInteger(z.number().int().min(0), 30000),
  DEPLOYMENT_LIFECYCLE_WEBHOOK_URL: z.string().default(''),
  DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN: z.string().default('')
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  return WorkerEnvSchema.parse(source);
}
