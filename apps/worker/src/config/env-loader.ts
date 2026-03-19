import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface LoadEnvFilesOptions {
  workspaceRoot?: string;
  exists?: (path: string) => boolean;
  load?: (options: { path: string; override?: boolean }) => unknown;
}

const defaultWorkspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');

export function loadEnvFiles(options: LoadEnvFilesOptions = {}) {
  const workspaceRoot = options.workspaceRoot ?? defaultWorkspaceRoot;
  const pathExists = options.exists ?? existsSync;
  const load = options.load ?? dotenv.config;

  const rootEnvPath = resolve(workspaceRoot, '.env');
  if (pathExists(rootEnvPath)) {
    load({ path: rootEnvPath });
  }

  const workerEnvPath = resolve(workspaceRoot, 'apps/worker/.env');
  if (pathExists(workerEnvPath)) {
    load({ path: workerEnvPath, override: true });
  }
}
