import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const WorkerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DOCKER_SOCKET_PATH: z.string().default('/var/run/docker.sock'),
  WORK_DIR: z.string().default('.tmp/deployments'),
  PLATFORM_DOMAIN: z.string().default('platform.local'),
  CADDY_ADMIN_URL: z.string().url().default('http://localhost:2019'),
  DEPLOYMENT_DEFAULT_CONTAINER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DEPLOYMENT_DEFAULT_MEMORY_MB: z.coerce.number().int().min(64).default(512),
  DEPLOYMENT_DEFAULT_CPU_MILLICORES: z.coerce.number().int().min(100).default(500),
  DEPLOYMENT_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).default(14),
  DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT: z.coerce.number().int().min(100).default(2000),
  DEPLOYMENT_LOG_PRUNE_INTERVAL_MS: z.coerce.number().int().min(60000).default(300000),
  DEPLOYMENT_LOG_ARCHIVE_DIR: z.string().default('.tmp/log-archives'),
  DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS: z.coerce.number().int().min(60000).default(3600000),
  DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS: z.coerce.number().int().min(1).default(1),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER: z.enum(['http', 's3', 'gcs', 'azure']).default('http'),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN: z.string().default(''),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_INTERVAL_MS: z.coerce.number().int().min(60000).default(600000),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS: z.coerce.number().int().min(100).default(1000),
  DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS: z.coerce.number().int().min(100).default(30000),
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
  DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD: z.coerce.boolean().default(false),
  DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60000).default(3600000),
  DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS: z.coerce.number().int().min(1).default(30),
  DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS: z.coerce.number().int().min(1).default(90)
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;
export const env: WorkerEnv = WorkerEnvSchema.parse(process.env);
