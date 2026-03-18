import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueueMetrics, WorkerHealthResult } from '../services/alert-monitor.service.js';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ENCRYPTION_KEY ??= '12345678901234567890123456789012';

const { buildServer } = await import('./build-server.js');

function createBuildServerDependencies(options?: {
  pingImplementation?: () => Promise<string>;
  queueMetricsImplementation?: () => Promise<QueueMetrics>;
  workerHealthImplementation?: () => Promise<WorkerHealthResult>;
}) {
  let queueCloseCalls = 0;
  let redisQuitCalls = 0;
  let alertStartCalls = 0;
  let alertStopCalls = 0;

  const deploymentQueue = {
    async close() {
      queueCloseCalls += 1;
    }
  };

  const redisClient = {
    async ping() {
      return options?.pingImplementation?.() ?? 'PONG';
    },
    async quit() {
      redisQuitCalls += 1;
      return 'OK';
    }
  };

  const alertMonitor = {
    start() {
      alertStartCalls += 1;
    },
    stop() {
      alertStopCalls += 1;
    },
    async getQueueMetrics() {
      return options?.queueMetricsImplementation?.() ?? {
        queue: 'deployment',
        counts: {
          waiting: 2,
          active: 1,
          completed: 10,
          failed: 0,
          delayed: 0,
          paused: 0,
          prioritized: 0
        },
        sampledAt: '2026-03-18T12:00:00.000Z'
      } satisfies QueueMetrics;
    },
    async getWorkerHealth() {
      return options?.workerHealthImplementation?.() ?? {
        status: 'ok',
        heartbeatKey: 'vcloudrunner:worker:heartbeat',
        staleAfterMs: 45_000,
        timestamp: '2026-03-18T12:00:00.000Z',
        service: 'worker',
        pid: 1234,
        ageMs: 100
      } satisfies WorkerHealthResult;
    }
  };

  return {
    deploymentQueue,
    redisClient,
    alertMonitor,
    getCounts() {
      return {
        queueCloseCalls,
        redisQuitCalls,
        alertStartCalls,
        alertStopCalls
      };
    }
  };
}

test('buildServer exposes health endpoint with request id and closes injected dependencies', async () => {
  const dependencies = createBuildServerDependencies();
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/health'
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { status: 'ok' });
  assert.ok(res.headers['x-request-id']);
  assert.equal(dependencies.getCounts().alertStartCalls, 1);

  await app.close();

  assert.deepEqual(dependencies.getCounts(), {
    queueCloseCalls: 1,
    redisQuitCalls: 1,
    alertStartCalls: 1,
    alertStopCalls: 1
  });
});

test('buildServer returns queue health payload when redis ping succeeds', async () => {
  const dependencies = createBuildServerDependencies({
    queueMetricsImplementation: async () => ({
      queue: 'deployment',
      counts: {
        waiting: 5,
        active: 2,
        completed: 20,
        failed: 1,
        delayed: 0,
        paused: 0,
        prioritized: 3
      },
      sampledAt: '2026-03-18T12:34:56.000Z'
    })
  });
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/health/queue'
  });

  await app.close();

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    status: 'ok',
    redis: 'PONG',
    queue: 'deployment',
    counts: {
      waiting: 5,
      active: 2,
      completed: 20,
      failed: 1,
      delayed: 0,
      paused: 0,
      prioritized: 3
    },
    sampledAt: '2026-03-18T12:34:56.000Z'
  });
});

test('buildServer returns queue health unavailable when redis ping fails', async () => {
  const dependencies = createBuildServerDependencies({
    pingImplementation: async () => {
      throw new Error('redis unavailable');
    }
  });
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/health/queue'
  });

  await app.close();

  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body).status, 'unavailable');
  assert.match(JSON.parse(res.body).message, /redis unavailable/);
});

test('buildServer marks queue health as degraded when redis ping is not PONG', async () => {
  const dependencies = createBuildServerDependencies({
    pingImplementation: async () => 'LOADING'
  });
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/health/queue'
  });

  await app.close();

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    status: 'degraded',
    redis: 'LOADING',
    queue: 'deployment',
    counts: {
      waiting: 2,
      active: 1,
      completed: 10,
      failed: 0,
      delayed: 0,
      paused: 0,
      prioritized: 0
    },
    sampledAt: '2026-03-18T12:00:00.000Z'
  });
});

test('buildServer preserves stale worker health payloads on health endpoint', async () => {
  const dependencies = createBuildServerDependencies({
    workerHealthImplementation: async () => ({
      status: 'stale',
      heartbeatKey: 'vcloudrunner:test:heartbeat',
      staleAfterMs: 45_000,
      ageMs: 60_000,
      timestamp: '2026-03-18T12:00:00.000Z',
      service: 'worker',
      pid: 4321
    })
  });
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/health/worker'
  });

  await app.close();

  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body), {
    status: 'stale',
    heartbeatKey: 'vcloudrunner:test:heartbeat',
    staleAfterMs: 45_000,
    ageMs: 60_000,
    timestamp: '2026-03-18T12:00:00.000Z',
    service: 'worker',
    pid: 4321
  });
});

test('buildServer exposes raw queue metrics with request id on metrics endpoint', async () => {
  const dependencies = createBuildServerDependencies({
    queueMetricsImplementation: async () => ({
      queue: 'deployment',
      counts: {
        waiting: 9,
        active: 4,
        completed: 21,
        failed: 2,
        delayed: 1,
        paused: 0,
        prioritized: 5
      },
      sampledAt: '2026-03-18T13:00:00.000Z'
    })
  });
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/metrics/queue'
  });

  await app.close();

  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['x-request-id']);
  assert.deepEqual(JSON.parse(res.body), {
    queue: 'deployment',
    counts: {
      waiting: 9,
      active: 4,
      completed: 21,
      failed: 2,
      delayed: 1,
      paused: 0,
      prioritized: 5
    },
    sampledAt: '2026-03-18T13:00:00.000Z'
  });
});

test('buildServer maps thrown queue metric errors to unavailable', async () => {
  const dependencies = createBuildServerDependencies({
    queueMetricsImplementation: async () => {
      throw new Error('queue metrics unavailable');
    }
  });
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/metrics/queue'
  });

  await app.close();

  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body).status, 'unavailable');
  assert.match(JSON.parse(res.body).message, /queue metrics unavailable/);
});

test('buildServer exposes raw stale worker metrics but maps thrown worker metric errors to unavailable', async () => {
  const staleDependencies = createBuildServerDependencies({
    workerHealthImplementation: async () => ({
      status: 'stale',
      heartbeatKey: 'vcloudrunner:test:metrics-heartbeat',
      staleAfterMs: 45_000,
      ageMs: 70_000,
      timestamp: '2026-03-18T13:30:00.000Z',
      service: 'worker',
      pid: 9876
    })
  });
  const staleApp = buildServer(staleDependencies);

  const staleRes = await staleApp.inject({
    method: 'GET',
    url: '/metrics/worker'
  });

  await staleApp.close();

  assert.equal(staleRes.statusCode, 200);
  assert.deepEqual(JSON.parse(staleRes.body), {
    status: 'stale',
    heartbeatKey: 'vcloudrunner:test:metrics-heartbeat',
    staleAfterMs: 45_000,
    ageMs: 70_000,
    timestamp: '2026-03-18T13:30:00.000Z',
    service: 'worker',
    pid: 9876
  });

  const failingDependencies = createBuildServerDependencies({
    workerHealthImplementation: async () => {
      throw new Error('worker metrics unavailable');
    }
  });
  const failingApp = buildServer(failingDependencies);

  const failingRes = await failingApp.inject({
    method: 'GET',
    url: '/metrics/worker'
  });

  await failingApp.close();

  assert.equal(failingRes.statusCode, 503);
  assert.deepEqual(JSON.parse(failingRes.body).status, 'unavailable');
  assert.match(JSON.parse(failingRes.body).message, /worker metrics unavailable/);
});
