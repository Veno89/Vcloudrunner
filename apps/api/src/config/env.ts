import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertSafeEnv, emitStartupWarnings, parseEnv, type AppEnv } from './env-core.js';

const rootEnvPath = resolve(process.cwd(), '.env');
if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const apiEnvPath = resolve(process.cwd(), 'apps/api/.env');
if (existsSync(apiEnvPath)) {
  dotenv.config({ path: apiEnvPath, override: true });
}

const parsedEnv = parseEnv(process.env);
assertSafeEnv(parsedEnv);
emitStartupWarnings(parsedEnv);

export const env: AppEnv = parsedEnv;
export type { AppEnv };
