import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueueMetrics, WorkerHealthResult } from '../services/alert-monitor.service.js';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { buildServer } = await import('./build-server.js');
const { env } = await import('../config/env.js');

async function withEnvOverrides(
  overrides: Partial<typeof env>,
  run: () => Promise<void>
) {
  const originalValues = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, env[key as keyof typeof env]])
  );

  Object.assign(env, overrides);

  try {
    await run();
  } finally {
    Object.assign(env, originalValues);
  }
}

function createBuildServerDependencies(options?: {
  pingImplementation?: () => Promise<string>;
  queueMetricsImplementation?: () => Promise<QueueMetrics>;
  workerHealthImplementation?: () => Promise<WorkerHealthResult>;
  closeQueueImplementation?: () => Promise<void>;
  quitRedisImplementation?: () => Promise<unknown>;
}) {
  let queueCloseCalls = 0;
  let redisQuitCalls = 0;
  let alertStartCalls = 0;
  let alertStopCalls = 0;
  let domainRefreshStartCalls = 0;
  let domainRefreshStopCalls = 0;

  const deploymentQueue = {
    async close() {
      queueCloseCalls += 1;
      await options?.closeQueueImplementation?.();
    }
  };

  const redisClient = {
    async ping() {
      return options?.pingImplementation?.() ?? 'PONG';
    },
    async quit() {
      redisQuitCalls += 1;
      return options?.quitRedisImplementation?.() ?? 'OK';
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

  const projectDomainDiagnosticsRefresh = {
    start() {
      domainRefreshStartCalls += 1;
    },
    stop() {
      domainRefreshStopCalls += 1;
    }
  };

  return {
    deploymentQueue,
    redisClient,
    alertMonitor,
    projectDomainDiagnosticsRefresh,
    getCounts() {
      return {
        queueCloseCalls,
        redisQuitCalls,
        alertStartCalls,
        alertStopCalls,
        domainRefreshStartCalls,
        domainRefreshStopCalls
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
    alertStopCalls: 1,
    domainRefreshStartCalls: 1,
    domainRefreshStopCalls: 1
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

test('buildServer applies allowlisted CORS headers for configured origins', async () => {
  await withEnvOverrides({
    CORS_ALLOWED_ORIGINS: 'https://allowed.example.com',
    CORS_ALLOW_CREDENTIALS: true
  }, async () => {
    const dependencies = createBuildServerDependencies();
    const app = buildServer(dependencies);

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'https://allowed.example.com'
      }
    });

    await app.close();

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'https://allowed.example.com');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });
});

test('buildServer rejects disallowed CORS origins with an explicit 403 response', async () => {
  await withEnvOverrides({
    CORS_ALLOWED_ORIGINS: 'https://allowed.example.com',
    CORS_ALLOW_CREDENTIALS: true
  }, async () => {
    const dependencies = createBuildServerDependencies();
    const app = buildServer(dependencies);

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'https://blocked.example.com'
      }
    });

    await app.close();

    assert.equal(res.statusCode, 403);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.ok(res.headers['x-request-id']);
    assert.deepEqual(JSON.parse(res.body), {
      code: 'REQUEST_ERROR',
      message: 'Origin not allowed by CORS',
      requestId: res.headers['x-request-id']
    });
  });
});

test('buildServer maps thrown worker health errors to unavailable on health endpoint', async () => {
  const dependencies = createBuildServerDependencies({
    workerHealthImplementation: async () => {
      throw new Error('worker health unavailable');
    }
  });
  const app = buildServer(dependencies);

  const res = await app.inject({
    method: 'GET',
    url: '/health/worker'
  });

  await app.close();

  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body).status, 'unavailable');
  assert.match(JSON.parse(res.body).message, /worker health unavailable/);
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

test('buildServer enforces configured rate limits and exposes rate-limit headers', async () => {
  await withEnvOverrides({
    API_RATE_LIMIT_MAX: 1,
    API_RATE_LIMIT_WINDOW_MS: 60_000,
    API_RATE_LIMIT_ALLOWLIST: ''
  }, async () => {
    const dependencies = createBuildServerDependencies();
    const app = buildServer(dependencies);

    const firstRes = await app.inject({
      method: 'GET',
      url: '/health'
    });
    const secondRes = await app.inject({
      method: 'GET',
      url: '/health'
    });

    await app.close();

    assert.equal(firstRes.statusCode, 200);
    assert.equal(firstRes.headers['x-ratelimit-limit'], '1');
    assert.ok(firstRes.headers['x-ratelimit-remaining']);
    assert.ok(firstRes.headers['x-ratelimit-reset']);
    assert.equal(secondRes.statusCode, 429);
  });
});

test('buildServer ignores forwarded allowlist IPs when trust proxy is disabled', async () => {
  await withEnvOverrides({
    TRUST_PROXY: false,
    API_RATE_LIMIT_MAX: 1,
    API_RATE_LIMIT_WINDOW_MS: 60_000,
    API_RATE_LIMIT_ALLOWLIST: '203.0.113.10'
  }, async () => {
    const dependencies = createBuildServerDependencies();
    const app = buildServer(dependencies);

    const firstRes = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-forwarded-for': '203.0.113.10'
      }
    });
    const secondRes = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-forwarded-for': '203.0.113.10'
      }
    });

    await app.close();

    assert.equal(firstRes.statusCode, 200);
    assert.equal(secondRes.statusCode, 429);
  });
});

test('buildServer honors forwarded allowlist IPs when trust proxy is enabled', async () => {
  await withEnvOverrides({
    TRUST_PROXY: true,
    API_RATE_LIMIT_MAX: 1,
    API_RATE_LIMIT_WINDOW_MS: 60_000,
    API_RATE_LIMIT_ALLOWLIST: '203.0.113.10'
  }, async () => {
    const dependencies = createBuildServerDependencies();
    const app = buildServer(dependencies);

    const firstRes = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-forwarded-for': '203.0.113.10'
      }
    });
    const secondRes = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-forwarded-for': '203.0.113.10'
      }
    });

    await app.close();

    assert.equal(firstRes.statusCode, 200);
    assert.equal(secondRes.statusCode, 200);
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

test('buildServer still closes cleanly when queue and redis shutdown hooks fail', async () => {
  const dependencies = createBuildServerDependencies({
    closeQueueImplementation: async () => {
      throw new Error('queue close failed');
    },
    quitRedisImplementation: async () => {
      throw new Error('redis quit failed');
    }
  });
  const app = buildServer(dependencies);

  await app.ready();
  await app.close();

  assert.deepEqual(dependencies.getCounts(), {
    queueCloseCalls: 1,
    redisQuitCalls: 1,
    alertStartCalls: 1,
    alertStopCalls: 1,
    domainRefreshStartCalls: 1,
    domainRefreshStopCalls: 1
  });
});
