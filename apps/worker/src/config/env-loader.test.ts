import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import { loadEnvFiles } from './env-loader.js';

test('loadEnvFiles loads root .env first and app-local worker env with override', () => {
  const workspaceRoot = resolve('C:/vcloudrunner-test');
  const loaded: Array<{ path: string; override?: boolean }> = [];
  const existingPaths = new Set([
    resolve(workspaceRoot, '.env'),
    resolve(workspaceRoot, 'apps/worker/.env')
  ]);

  loadEnvFiles({
    workspaceRoot,
    exists: (path) => existingPaths.has(path),
    load: (options) => {
      loaded.push(options);
    }
  });

  assert.deepEqual(loaded, [
    { path: resolve(workspaceRoot, '.env') },
    { path: resolve(workspaceRoot, 'apps/worker/.env'), override: true }
  ]);
});

test('loadEnvFiles skips env files that are not present', () => {
  const loaded: Array<{ path: string; override?: boolean }> = [];

  loadEnvFiles({
    workspaceRoot: resolve('C:/vcloudrunner-test'),
    exists: () => false,
    load: (options) => {
      loaded.push(options);
    }
  });

  assert.deepEqual(loaded, []);
});

test('loadEnvFiles resolves worker env files from workspace root instead of command cwd assumptions', () => {
  const workspaceRoot = resolve('C:/vcloudrunner-test');
  const loaded: Array<{ path: string; override?: boolean }> = [];
  const existingPaths = new Set([
    resolve(workspaceRoot, '.env'),
    resolve(workspaceRoot, 'apps/worker/.env')
  ]);

  loadEnvFiles({
    workspaceRoot,
    exists: (path) => existingPaths.has(path),
    load: (options) => {
      loaded.push(options);
    }
  });

  assert.deepEqual(loaded, [
    { path: resolve(workspaceRoot, '.env') },
    { path: resolve(workspaceRoot, 'apps/worker/.env'), override: true }
  ]);
});
