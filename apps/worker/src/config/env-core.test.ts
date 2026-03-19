import assert from 'node:assert/strict';
import test from 'node:test';

import { parseEnv } from './env-core.js';

const REQUIRED_ENV = {
  REDIS_URL: 'redis://localhost:6379',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/vcloudrunner'
};

test('parseEnv defaults archive deletion flag to false', () => {
  const env = parseEnv(REQUIRED_ENV);

  assert.equal(env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD, false);
});

test('parseEnv honors explicit false string values for worker boolean flags', () => {
  const env = parseEnv({
    ...REQUIRED_ENV,
    DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD: 'false'
  });

  assert.equal(env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD, false);
});

test('parseEnv honors common truthy and falsy worker env boolean strings', () => {
  const enabledEnv = parseEnv({
    ...REQUIRED_ENV,
    DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD: 'on'
  });
  const disabledEnv = parseEnv({
    ...REQUIRED_ENV,
    DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD: '0'
  });

  assert.equal(enabledEnv.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD, true);
  assert.equal(disabledEnv.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD, false);
});

test('parseEnv rejects invalid worker boolean strings', () => {
  assert.throws(
    () => parseEnv({
      ...REQUIRED_ENV,
      DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD: 'definitely'
    }),
    /Expected boolean/
  );
});

test('parseEnv defaults blank worker numeric strings instead of coercing them to zero', () => {
  const env = parseEnv({
    ...REQUIRED_ENV,
    DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS: '',
    DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS: ' ',
    DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT: ''
  });

  assert.equal(env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS, 3);
  assert.equal(env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS, 30000);
  assert.equal(env.DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT, 2000);
});

test('parseEnv preserves explicit zero-valued worker numeric strings where zero is valid', () => {
  const env = parseEnv({
    ...REQUIRED_ENV,
    DB_POOL_STATEMENT_TIMEOUT_MS: '0'
  });

  assert.equal(env.DB_POOL_STATEMENT_TIMEOUT_MS, 0);
});

test('parseEnv rejects malformed worker numeric strings', () => {
  assert.throws(
    () =>
      parseEnv({
        ...REQUIRED_ENV,
        DEPLOYMENT_EXECUTION_TIMEOUT_MS: '10m'
      }),
    /Expected number/
  );
});
