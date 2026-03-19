import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface LoadEnvFilesOptions {
  cwd?: string;
  exists?: (path: string) => boolean;
  load?: (options: { path: string; override?: boolean }) => unknown;
}

export function loadEnvFiles(options: LoadEnvFilesOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const pathExists = options.exists ?? existsSync;
  const load = options.load ?? dotenv.config;

  const rootEnvPath = resolve(cwd, '.env');
  if (pathExists(rootEnvPath)) {
    load({ path: rootEnvPath });
  }

  const apiEnvPath = resolve(cwd, 'apps/api/.env');
  if (pathExists(apiEnvPath)) {
    load({ path: apiEnvPath, override: true });
  }
}
