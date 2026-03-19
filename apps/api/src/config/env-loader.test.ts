import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import { loadEnvFiles } from './env-loader.js';

test('loadEnvFiles loads root .env first and app-local api env with override', () => {
  const cwd = resolve('C:/vcloudrunner-test');
  const loaded: Array<{ path: string; override?: boolean }> = [];
  const existingPaths = new Set([
    resolve(cwd, '.env'),
    resolve(cwd, 'apps/api/.env')
  ]);

  loadEnvFiles({
    cwd,
    exists: (path) => existingPaths.has(path),
    load: (options) => {
      loaded.push(options);
    }
  });

  assert.deepEqual(loaded, [
    { path: resolve(cwd, '.env') },
    { path: resolve(cwd, 'apps/api/.env'), override: true }
  ]);
});

test('loadEnvFiles skips env files that are not present', () => {
  const loaded: Array<{ path: string; override?: boolean }> = [];

  loadEnvFiles({
    cwd: resolve('C:/vcloudrunner-test'),
    exists: () => false,
    load: (options) => {
      loaded.push(options);
    }
  });

  assert.deepEqual(loaded, []);
});
