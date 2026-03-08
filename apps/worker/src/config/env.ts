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
  DEPLOYMENT_DEFAULT_CPU_MILLICORES: z.coerce.number().int().min(100).default(500)
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;
export const env: WorkerEnv = WorkerEnvSchema.parse(process.env);
