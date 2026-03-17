import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeEnv, emitStartupWarnings, parseEnv } from './env-core.js';

const REQUIRED_ENV = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://:pass@localhost:6379/0',
  ENCRYPTION_KEY: '12345678901234567890123456789012'
};

test('assertSafeEnv throws when production enables dev auth', () => {
  const env = parseEnv({ ...REQUIRED_ENV, NODE_ENV: 'production', ENABLE_DEV_AUTH: 'true' });

  assert.throws(() => assertSafeEnv(env), /ENABLE_DEV_AUTH must be false/);
});


test('assertSafeEnv throws when production enables static API tokens fallback', () => {
  const env = parseEnv({
    ...REQUIRED_ENV,
    NODE_ENV: 'production',
    API_TOKENS_JSON: '[{"token":"abc"}]'
  });

  assert.throws(() => assertSafeEnv(env), /API_TOKENS_JSON must be empty/);
});

test('emitStartupWarnings warns for development dev auth bypass', () => {
  const env = parseEnv({ ...REQUIRED_ENV, NODE_ENV: 'development', ENABLE_DEV_AUTH: 'true' });
  const warnings: string[] = [];

  emitStartupWarnings(env, (message: string) => warnings.push(message));

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ENABLE_DEV_AUTH is enabled/);
});

test('emitStartupWarnings warns for API_TOKENS_JSON fallback usage', () => {
  const env = parseEnv({
    ...REQUIRED_ENV,
    NODE_ENV: 'development',
    API_TOKENS_JSON: '[{"token":"abc"}]'
  });
  const warnings: string[] = [];

  emitStartupWarnings(env, (message: string) => warnings.push(message));

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /API_TOKENS_JSON static token fallback/);
});


test('emitStartupWarnings is silent for test env dev-auth bypass config', () => {
  const env = parseEnv({ ...REQUIRED_ENV, NODE_ENV: 'test', ENABLE_DEV_AUTH: 'true' });
  const warnings: string[] = [];

  emitStartupWarnings(env, (message: string) => warnings.push(message));

  assert.deepEqual(warnings, []);
});

test('emitStartupWarnings is silent for safe config', () => {
  const env = parseEnv({ ...REQUIRED_ENV, NODE_ENV: 'production', ENABLE_DEV_AUTH: 'false' });
  const warnings: string[] = [];

  emitStartupWarnings(env, (message: string) => warnings.push(message));

  assert.deepEqual(warnings, []);
});
