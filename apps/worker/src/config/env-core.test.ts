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
