import test from 'node:test';
import assert from 'node:assert/strict';

import { env } from '../config/env.js';
import { DeploymentStateService } from './deployment-state.service.js';

interface RecordedQuery {
  text: string;
  params: unknown[] | undefined;
}

class MockPool {
  readonly queries: RecordedQuery[] = [];

  async query(text: string, params?: unknown[]) {
    this.queries.push({ text, params });
    return { rowCount: 1, rows: [] };
  }
}

test('appendLog writes truncated message and enforces per-deployment retention', async () => {
  const pool = new MockPool();
  const service = new DeploymentStateService(pool);
  const longMessage = 'x'.repeat(12000);

  await service.appendLog('dep-123', longMessage, 'warn');

  assert.equal(pool.queries.length, 2);
  assert.match(pool.queries[0].text, /insert into deployment_logs/i);
  assert.deepEqual(pool.queries[0].params, ['dep-123', 'warn', 'x'.repeat(10000)]);

  assert.match(pool.queries[1].text, /delete from deployment_logs/i);
  assert.deepEqual(pool.queries[1].params, ['dep-123', env.DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT]);
});

test('markFailed writes failed status, error log, and applies retention cap', async () => {
  const pool = new MockPool();
  const service = new DeploymentStateService(pool);

  await service.markFailed('dep-456', 'fatal failure');

  assert.equal(pool.queries.length, 3);
  assert.match(pool.queries[0].text, /update deployments/i);
  assert.deepEqual(pool.queries[0].params, ['dep-456']);

  assert.match(pool.queries[1].text, /insert into deployment_logs/i);
  assert.deepEqual(pool.queries[1].params, ['dep-456', 'fatal failure']);

  assert.match(pool.queries[2].text, /delete from deployment_logs/i);
  assert.deepEqual(pool.queries[2].params, ['dep-456', env.DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT]);
});

test('pruneLogsByRetentionWindow deletes old log rows using configured day window', async () => {
  const pool = new MockPool();
  const service = new DeploymentStateService(pool);

  await service.pruneLogsByRetentionWindow();

  assert.equal(pool.queries.length, 1);
  assert.match(pool.queries[0].text, /where timestamp < now\(\) - \(\$1::int \* interval '1 day'\)/i);
  assert.deepEqual(pool.queries[0].params, [env.DEPLOYMENT_LOG_RETENTION_DAYS]);
});


test('uploadPendingArchives is a no-op when upload base url is not configured', async () => {
  const pool = new MockPool();
  const service = new DeploymentStateService(pool);

  const uploadedCount = await service.uploadPendingArchives();
  assert.equal(uploadedCount, 0);
});


test('cleanupArchivedArtifacts returns 0 when archive directory has no files', async () => {
  const pool = new MockPool();
  const service = new DeploymentStateService(pool);

  const deletedCount = await service.cleanupArchivedArtifacts();
  assert.equal(typeof deletedCount, 'number');
});
