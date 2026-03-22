import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

await import('../../test/worker-test-env.js');

const { GzipNdjsonDeploymentLogArchiveBuilder } = await import('./gzip-ndjson-deployment-log-archive-builder.js');

test('GzipNdjsonDeploymentLogArchiveBuilder encodes deployment log rows as gzipped NDJSON', () => {
  const builder = new GzipNdjsonDeploymentLogArchiveBuilder();

  const archive = builder.buildArchive([
    {
      id: 'log-1',
      deployment_id: 'dep-1',
      level: 'info',
      message: 'first line',
      timestamp: '2026-03-22T00:00:00.000Z'
    },
    {
      id: 'log-2',
      deployment_id: 'dep-1',
      level: 'error',
      message: 'second line',
      timestamp: '2026-03-22T00:01:00.000Z'
    }
  ]);

  const decoded = gunzipSync(archive).toString('utf8');
  const lines = decoded.trimEnd().split('\n').map((line) => JSON.parse(line));

  assert.deepEqual(lines, [
    {
      id: 'log-1',
      deploymentId: 'dep-1',
      level: 'info',
      message: 'first line',
      timestamp: '2026-03-22T00:00:00.000Z'
    },
    {
      id: 'log-2',
      deploymentId: 'dep-1',
      level: 'error',
      message: 'second line',
      timestamp: '2026-03-22T00:01:00.000Z'
    }
  ]);
});
