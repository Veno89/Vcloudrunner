import assert from 'node:assert/strict';
import test from 'node:test';

import type { DeploymentJobPayload } from '@vcloudrunner/shared-types';

type TestJob = {
  data: { deploymentId: string };
  remove: () => Promise<void>;
};

async function loadDeploymentQueue() {
  process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/db';
  process.env.REDIS_URL ??= 'redis://:pass@localhost:6379/0';
  process.env.ENCRYPTION_KEY ??= '12345678901234567890123456789012';

  const module = await import('./deployment-queue.js');
  return module.DeploymentQueue;
}

test('enqueue applies deterministic jobId based on deploymentId', async () => {
  const DeploymentQueue = await loadDeploymentQueue();
  const calls: Array<{ name: string; payload: DeploymentJobPayload; opts: Record<string, unknown> }> = [];
  const queue = new DeploymentQueue({
    add: async (name, payload, opts) => {
      calls.push({ name, payload, opts: (opts ?? {}) as Record<string, unknown> });
      return {} as never;
    },
    getJob: async () => undefined,
    getJobs: async () => [] as never
  });

  const payload = {
    deploymentId: 'dep-1',
    projectId: 'proj-1',
    projectSlug: 'proj-1',
    gitRepositoryUrl: 'https://example.com/repo.git',
    branch: 'main',
    commitSha: 'abc123',
    env: {},
    runtime: {
      containerPort: 3000,
      memoryMb: 512,
      cpuMillicores: 500
    }
  } satisfies DeploymentJobPayload;

  await queue.enqueue(payload);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'deploy');
  assert.equal(calls[0].payload.deploymentId, 'dep-1');
  assert.equal(calls[0].opts.jobId, 'dep-1');
});

test('cancelQueuedDeployment removes direct job-id match first', async () => {
  const DeploymentQueue = await loadDeploymentQueue();
  let scanCalled = false;
  const removed: string[] = [];
  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => ({
      data: { deploymentId: 'dep-direct' },
      remove: async () => {
        removed.push('dep-direct');
      }
    }) as never,
    getJobs: async () => {
      scanCalled = true;
      return [] as never;
    }
  });

  const result = await queue.cancelQueuedDeployment('dep-direct');

  assert.equal(result, true);
  assert.equal(scanCalled, false);
  assert.deepEqual(removed, ['dep-direct']);
});



test('cancelQueuedDeployment falls back to scan when direct remove throws', async () => {
  const DeploymentQueue = await loadDeploymentQueue();
  const removed: string[] = [];

  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => ({
      data: { deploymentId: 'dep-a' },
      remove: async () => {
        throw new Error('locked');
      }
    }) as never,
    getJobs: async () =>
      [
        {
          data: { deploymentId: 'dep-a' },
          remove: async () => {
            removed.push('dep-a');
          }
        }
      ] as never
  });

  const result = await queue.cancelQueuedDeployment('dep-a');

  assert.equal(result, true);
  assert.deepEqual(removed, ['dep-a']);
});

test('cancelQueuedDeployment falls back to scan when direct lookup throws', async () => {
  const DeploymentQueue = await loadDeploymentQueue();
  const removed: string[] = [];

  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => {
      throw new Error('lookup unavailable');
    },
    getJobs: async () =>
      [
        {
          data: { deploymentId: 'dep-race' },
          remove: async () => {
            removed.push('dep-race');
          }
        }
      ] as never
  });

  const result = await queue.cancelQueuedDeployment('dep-race');

  assert.equal(result, true);
  assert.deepEqual(removed, ['dep-race']);
});

test('cancelQueuedDeployment removes matching jobs via fallback queue scan', async () => {
  const DeploymentQueue = await loadDeploymentQueue();
  const removed: string[] = [];
  const jobs: TestJob[] = [
    {
      data: { deploymentId: 'dep-a' },
      remove: async () => {
        removed.push('dep-a');
      }
    },
    {
      data: { deploymentId: 'dep-b' },
      remove: async () => {
        removed.push('dep-b');
      }
    },
    {
      data: { deploymentId: 'dep-a' },
      remove: async () => {
        removed.push('dep-a-2');
      }
    }
  ];

  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => undefined,
    getJobs: async () => jobs as never
  });

  const result = await queue.cancelQueuedDeployment('dep-a');

  assert.equal(result, true);
  assert.deepEqual(removed, ['dep-a', 'dep-a-2']);
});

test('cancelQueuedDeployment continues fallback scan when one matching remove races away', async () => {
  const DeploymentQueue = await loadDeploymentQueue();
  const removed: string[] = [];

  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => undefined,
    getJobs: async () =>
      [
        {
          data: { deploymentId: 'dep-race' },
          remove: async () => {
            throw new Error('already claimed');
          }
        },
        {
          data: { deploymentId: 'dep-race' },
          remove: async () => {
            removed.push('dep-race-second');
          }
        }
      ] as never
  });

  const result = await queue.cancelQueuedDeployment('dep-race');

  assert.equal(result, true);
  assert.deepEqual(removed, ['dep-race-second']);
});

test('cancelQueuedDeployment returns false when no matching queued jobs exist', async () => {
  const DeploymentQueue = await loadDeploymentQueue();
  const jobs: TestJob[] = [
    {
      data: { deploymentId: 'dep-x' },
      remove: async () => undefined
    }
  ];

  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => undefined,
    getJobs: async () => jobs as never
  });

  const result = await queue.cancelQueuedDeployment('dep-missing');

  assert.equal(result, false);
});

test('cancelQueuedDeployment returns false when every matching fallback removal races away', async () => {
  const DeploymentQueue = await loadDeploymentQueue();

  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => undefined,
    getJobs: async () =>
      [
        {
          data: { deploymentId: 'dep-race-all' },
          remove: async () => {
            throw new Error('already removed');
          }
        }
      ] as never
  });

  const result = await queue.cancelQueuedDeployment('dep-race-all');

  assert.equal(result, false);
});

test('cancelQueuedDeployment returns false when direct lookup throws and scan finds nothing', async () => {
  const DeploymentQueue = await loadDeploymentQueue();

  const queue = new DeploymentQueue({
    add: async () => ({} as never),
    getJob: async () => {
      throw new Error('lookup unavailable');
    },
    getJobs: async () => [] as never
  });

  const result = await queue.cancelQueuedDeployment('dep-missing');

  assert.equal(result, false);
});
