import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { logger } = await import('../logger/logger.js');
const { DeploymentStateService } = await import('./deployment-state.service.js');

interface RecordedQuery {
  text: string;
  params: unknown[] | undefined;
}

class MockPool {
  readonly queries: RecordedQuery[] = [];

  constructor(
    private readonly onQuery?: (text: string, params: unknown[] | undefined) => void | Promise<void>
  ) {}

  async query(text: string, params?: unknown[]) {
    this.queries.push({ text, params });
    await this.onQuery?.(text, params);
    return { rowCount: 1, rows: [] };
  }
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
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
  assert.deepEqual(pool.queries[1].params, ['dep-456', 'error', 'fatal failure']);

  assert.match(pool.queries[2].text, /delete from deployment_logs/i);
  assert.deepEqual(pool.queries[2].params, ['dep-456', env.DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT]);
});

test('markFailed still succeeds when the failure log insert fails after the status update', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const originalWarn = logger.warn;
  const pool = new MockPool(async (text) => {
    if (/insert into deployment_logs/i.test(text)) {
      throw new Error('log insert failed');
    }
  });
  const service = new DeploymentStateService(pool);

  logger.warn = (message, metadata) => {
    warnings.push({ message, metadata });
  };

  try {
    await service.markFailed('dep-log-fail-failed', 'fatal failure');
  } finally {
    logger.warn = originalWarn;
  }

  assert.equal(pool.queries.length, 3);
  assert.match(pool.queries[0].text, /update deployments/i);
  assert.match(pool.queries[1].text, /insert into deployment_logs/i);
  assert.match(pool.queries[2].text, /delete from deployment_logs/i);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment failed log insert failed after status update');
  assert.equal(warnings[0]?.metadata?.deploymentId, 'dep-log-fail-failed');
});

test('appendLog still succeeds when retention enforcement fails after the log write', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const originalWarn = logger.warn;
  const pool = new MockPool(async (text) => {
    if (/delete from deployment_logs/i.test(text)) {
      throw new Error('retention delete failed');
    }
  });
  const service = new DeploymentStateService(pool);

  logger.warn = (message, metadata) => {
    warnings.push({ message, metadata });
  };

  try {
    await service.appendLog('dep-retention-log', 'hello world', 'info');
  } finally {
    logger.warn = originalWarn;
  }

  assert.equal(pool.queries.length, 2);
  assert.match(pool.queries[0].text, /insert into deployment_logs/i);
  assert.match(pool.queries[1].text, /delete from deployment_logs/i);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment log retention enforcement failed after write');
  assert.equal(warnings[0]?.metadata?.deploymentId, 'dep-retention-log');
});

test('markStopped still succeeds when retention enforcement fails after the stop write', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const originalWarn = logger.warn;
  const pool = new MockPool(async (text) => {
    if (/delete from deployment_logs/i.test(text)) {
      throw new Error('retention delete failed');
    }
  });
  const service = new DeploymentStateService(pool);

  logger.warn = (message, metadata) => {
    warnings.push({ message, metadata });
  };

  try {
    await service.markStopped('dep-retention-stop', 'cancelled');
  } finally {
    logger.warn = originalWarn;
  }

  assert.equal(pool.queries.length, 3);
  assert.match(pool.queries[0].text, /update deployments/i);
  assert.match(pool.queries[1].text, /insert into deployment_logs/i);
  assert.match(pool.queries[2].text, /delete from deployment_logs/i);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment log retention enforcement failed after write');
  assert.equal(warnings[0]?.metadata?.deploymentId, 'dep-retention-stop');
});

test('markStopped still succeeds when the stop log insert fails after the status update', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const originalWarn = logger.warn;
  const pool = new MockPool(async (text) => {
    if (/insert into deployment_logs/i.test(text)) {
      throw new Error('log insert failed');
    }
  });
  const service = new DeploymentStateService(pool);

  logger.warn = (message, metadata) => {
    warnings.push({ message, metadata });
  };

  try {
    await service.markStopped('dep-log-fail-stopped', 'cancelled');
  } finally {
    logger.warn = originalWarn;
  }

  assert.equal(pool.queries.length, 3);
  assert.match(pool.queries[0].text, /update deployments/i);
  assert.match(pool.queries[1].text, /insert into deployment_logs/i);
  assert.match(pool.queries[2].text, /delete from deployment_logs/i);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment stopped log insert failed after status update');
  assert.equal(warnings[0]?.metadata?.deploymentId, 'dep-log-fail-stopped');
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

test('recoverStuckDeployments continues after one deployment recovery fails', async () => {
  const service = new DeploymentStateService(new MockPool()) as unknown as {
    repository: { listStuckDeployments: () => Promise<Array<{ id: string; status: 'queued' | 'building' }>> };
    markFailed: (deploymentId: string, message: string) => Promise<void>;
    recoverStuckDeployments: () => Promise<number>;
  };
  const attemptedIds: string[] = [];

  service.repository = {
    listStuckDeployments: async () => [
      { id: 'dep-fail', status: 'queued' },
      { id: 'dep-ok', status: 'building' }
    ]
  };
  service.markFailed = async (deploymentId) => {
    attemptedIds.push(deploymentId);
    if (deploymentId === 'dep-fail') {
      throw new Error('database write failed');
    }
  };

  const recoveredCount = await service.recoverStuckDeployments();

  assert.equal(recoveredCount, 1);
  assert.deepEqual(attemptedIds, ['dep-fail', 'dep-ok']);
});

test('reconcileRunningDeployments continues after one container check fails', async () => {
  const service = new DeploymentStateService(new MockPool()) as unknown as {
    repository: {
      listRunningDeploymentContainers: () => Promise<Array<{ deployment_id: string; container_id: string }>>;
    };
    markFailed: (deploymentId: string, message: string) => Promise<void>;
    reconcileRunningDeployments: (
      isContainerRunning: (containerId: string) => Promise<boolean>
    ) => Promise<number>;
  };
  const checkedContainers: string[] = [];
  const failedDeployments: string[] = [];

  service.repository = {
    listRunningDeploymentContainers: async () => [
      { deployment_id: 'dep-skip', container_id: 'container-skip' },
      { deployment_id: 'dep-reconcile', container_id: 'container-reconcile' }
    ]
  };
  service.markFailed = async (deploymentId) => {
    failedDeployments.push(deploymentId);
  };

  const reconciledCount = await service.reconcileRunningDeployments(async (containerId) => {
    checkedContainers.push(containerId);
    if (containerId === 'container-skip') {
      throw new Error('container runtime unavailable');
    }

    return false;
  });

  assert.equal(reconciledCount, 1);
  assert.deepEqual(checkedContainers, ['container-skip', 'container-reconcile']);
  assert.deepEqual(failedDeployments, ['dep-reconcile']);
});

test('archiveEligibleDeploymentLogs continues after one archive build fails', async () => {
  const service = new DeploymentStateService(new MockPool()) as unknown as {
    repository: { listArchivableDeploymentIds: () => Promise<string[]> };
    archiveDeployment: (deploymentId: string) => Promise<boolean>;
    archiveEligibleDeploymentLogs: () => Promise<number>;
  };
  const attemptedIds: string[] = [];

  service.repository = {
    listArchivableDeploymentIds: async () => ['dep-fail', 'dep-ok']
  };
  service.archiveDeployment = async (deploymentId) => {
    attemptedIds.push(deploymentId);
    if (deploymentId === 'dep-fail') {
      throw new Error('archive write failed');
    }

    return true;
  };

  const archivedCount = await service.archiveEligibleDeploymentLogs();

  assert.equal(archivedCount, 1);
  assert.deepEqual(attemptedIds, ['dep-fail', 'dep-ok']);
});

test('uploadPendingArchives continues after one artifact upload fails', async () => {
  const originalArchiveDir = env.DEPLOYMENT_LOG_ARCHIVE_DIR;
  const originalUploadBaseUrl = env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL;
  const fixtureDir = await mkdtemp(join(tmpdir(), 'vcloudrunner-upload-partial-'));
  const failingArchivePath = join(fixtureDir, 'dep-fail.ndjson.gz');
  const successfulArchivePath = join(fixtureDir, 'dep-ok.ndjson.gz');

  await writeFile(failingArchivePath, Buffer.from('fail-payload'));
  await writeFile(successfulArchivePath, Buffer.from('ok-payload'));

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixtureDir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = 'https://uploads.example.test';

    const service = new DeploymentStateService(new MockPool()) as unknown as {
      createArchiveUploadRequest: (input: {
        fileName: string;
        baseUrl: string;
        payload: Buffer;
      }) => Promise<{ targetUrl: string; headers: Record<string, string> }>;
      uploadArchiveWithRetry: (input: {
        targetUrl: string;
        payload: Buffer;
        headers: Record<string, string>;
      }) => Promise<void>;
      uploadPendingArchives: () => Promise<number>;
    };
    const attemptedTargets: string[] = [];

    service.createArchiveUploadRequest = async ({ fileName, baseUrl }) => ({
      targetUrl: `${baseUrl}/${fileName}`,
      headers: { 'content-type': 'application/gzip' }
    });
    service.uploadArchiveWithRetry = async ({ targetUrl }) => {
      attemptedTargets.push(targetUrl);
      if (targetUrl.endsWith('/dep-fail.ndjson.gz')) {
        throw new Error('upload failed');
      }
    };

    const uploadedCount = await service.uploadPendingArchives();

    assert.equal(uploadedCount, 1);
    assert.deepEqual(attemptedTargets, [
      'https://uploads.example.test/dep-fail.ndjson.gz',
      'https://uploads.example.test/dep-ok.ndjson.gz'
    ]);
    assert.equal(await exists(`${failingArchivePath}.uploaded`), false);
    assert.equal(await exists(`${successfulArchivePath}.uploaded`), true);
  } finally {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = originalArchiveDir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = originalUploadBaseUrl;
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('cleanupArchivedArtifacts continues after one artifact cleanup fails', async () => {
  const originalArchiveDir = env.DEPLOYMENT_LOG_ARCHIVE_DIR;
  const originalArchiveMaxAgeDays = env.DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS;
  const originalMarkerMaxAgeDays = env.DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS;
  const fixtureDir = await mkdtemp(join(tmpdir(), 'vcloudrunner-cleanup-partial-'));
  const badMarkerPath = join(fixtureDir, 'dep-bad.ndjson.gz.uploaded');
  const goodMarkerPath = join(fixtureDir, 'dep-good.ndjson.gz.uploaded');

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixtureDir;
    env.DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS = 0;
    env.DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS = 0;

    await mkdir(badMarkerPath);
    await writeFile(goodMarkerPath, 'uploaded');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const service = new DeploymentStateService(new MockPool());
    const deletedCount = await service.cleanupArchivedArtifacts();

    assert.equal(deletedCount, 1);
    assert.equal(await exists(badMarkerPath), true);
    assert.equal(await exists(goodMarkerPath), false);
  } finally {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = originalArchiveDir;
    env.DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS = originalArchiveMaxAgeDays;
    env.DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS = originalMarkerMaxAgeDays;
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
