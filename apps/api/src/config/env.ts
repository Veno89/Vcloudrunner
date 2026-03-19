import { assertSafeEnv, emitStartupWarnings, parseEnv, type AppEnv } from './env-core.js';
import { loadEnvFiles } from './env-loader.js';

loadEnvFiles();

const parsedEnv = parseEnv(process.env);
assertSafeEnv(parsedEnv);
emitStartupWarnings(parsedEnv);

export const env: AppEnv = parsedEnv;
export type { AppEnv };
