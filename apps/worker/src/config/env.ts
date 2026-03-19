import { parseEnv, type WorkerEnv } from './env-core.js';
import { loadEnvFiles } from './env-loader.js';

loadEnvFiles();

export const env: WorkerEnv = parseEnv(process.env);
export type { WorkerEnv };
