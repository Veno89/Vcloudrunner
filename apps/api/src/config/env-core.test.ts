import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeEnv, emitStartupWarnings, parseEnv } from './env-core.js';

const REQUIRED_ENV = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://:pass@localhost:6379/0',
  ENCRYPTION_KEY: '12345678901234567890123456789012'
};

test('parseEnv defaults TRUST_PROXY to false', () => {
  const env = parseEnv(REQUIRED_ENV);

  assert.equal(env.TRUST_PROXY, false);
});

test('parseEnv honors explicit false string values for boolean flags', () => {
  const env = parseEnv({
    ...REQUIRED_ENV,
    TRUST_PROXY: 'false',
    CORS_ALLOW_CREDENTIALS: 'false',
    ENABLE_DEV_AUTH: 'false',
    OTEL_ENABLED: 'false'
  });

  assert.equal(env.TRUST_PROXY, false);
  assert.equal(env.CORS_ALLOW_CREDENTIALS, false);
  assert.equal(env.ENABLE_DEV_AUTH, false);
  assert.equal(env.OTEL_ENABLED, false);
});

test('parseEnv honors common truthy and falsy env boolean strings', () => {
  const env = parseEnv({
    ...REQUIRED_ENV,
    TRUST_PROXY: '1',
    CORS_ALLOW_CREDENTIALS: 'yes',
    ENABLE_DEV_AUTH: 'on',
    OTEL_ENABLED: '0'
  });

  assert.equal(env.TRUST_PROXY, true);
  assert.equal(env.CORS_ALLOW_CREDENTIALS, true);
  assert.equal(env.ENABLE_DEV_AUTH, true);
  assert.equal(env.OTEL_ENABLED, false);
});

test('parseEnv rejects invalid boolean strings', () => {
  assert.throws(
    () => parseEnv({ ...REQUIRED_ENV, ENABLE_DEV_AUTH: 'definitely' }),
    /Expected boolean/
  );
});

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

test('emitStartupWarnings stays silent when development dev auth is explicitly disabled', () => {
  const env = parseEnv({ ...REQUIRED_ENV, NODE_ENV: 'development', ENABLE_DEV_AUTH: 'false' });
  const warnings: string[] = [];

  emitStartupWarnings(env, (message: string) => warnings.push(message));

  assert.deepEqual(warnings, []);
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
