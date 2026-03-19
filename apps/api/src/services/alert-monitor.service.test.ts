import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

import { env } from '../config/env.js';
import { AlertMonitorService } from './alert-monitor.service.js';

type JobCounts = Record<string, number>;

class MockQueue {
  constructor(private readonly counts: JobCounts) {}

  async getJobCounts(...statuses: string[]) {
    void statuses;
    return this.counts;
  }
}

class MockRedis {
  constructor(private readonly heartbeat: string | null) {}

  async get(key: string) {
    void key;
    return this.heartbeat;
  }
}

function createService(options?: {
  counts?: JobCounts;
  heartbeat?: string | null;
  logger?: { warn: (obj: Record<string, unknown>, msg: string) => void };
}) {
  const logger = options?.logger ?? {
    warn: (obj: Record<string, unknown>, msg: string) => {
      void obj;
      void msg;
    }
  };

  return new AlertMonitorService(
    new MockQueue(options?.counts ?? {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      prioritized: 0
    }) as unknown as Queue,
    new MockRedis(options?.heartbeat ?? null) as unknown as Redis,
    'deployment',
    logger
  );
}

function withAlertEnv(t: TestContext, overrides: Partial<typeof env>) {
  const originals = {
    ALERT_WEBHOOK_URL: env.ALERT_WEBHOOK_URL,
    ALERT_WEBHOOK_AUTH_TOKEN: env.ALERT_WEBHOOK_AUTH_TOKEN,
    ALERT_MONITOR_INTERVAL_MS: env.ALERT_MONITOR_INTERVAL_MS,
    ALERT_COOLDOWN_MS: env.ALERT_COOLDOWN_MS,
    ALERT_QUEUE_WAITING_THRESHOLD: env.ALERT_QUEUE_WAITING_THRESHOLD,
    ALERT_QUEUE_ACTIVE_THRESHOLD: env.ALERT_QUEUE_ACTIVE_THRESHOLD,
    ALERT_QUEUE_FAILED_THRESHOLD: env.ALERT_QUEUE_FAILED_THRESHOLD,
    WORKER_HEARTBEAT_KEY: env.WORKER_HEARTBEAT_KEY,
    WORKER_HEARTBEAT_STALE_MS: env.WORKER_HEARTBEAT_STALE_MS
  };

  Object.assign(env, overrides);

  t.after(() => {
    Object.assign(env, originals);
  });
}

test('getQueueMetrics returns the configured queue name and counts', async () => {
  const service = createService({
    counts: {
      waiting: 3,
      active: 2,
      completed: 10,
      failed: 1,
      delayed: 0,
      paused: 0,
      prioritized: 4
    }
  });

  const metrics = await service.getQueueMetrics();

  assert.equal(metrics.queue, 'deployment');
  assert.deepEqual(metrics.counts, {
    waiting: 3,
    active: 2,
    completed: 10,
    failed: 1,
    delayed: 0,
    paused: 0,
    prioritized: 4
  });
  assert.match(metrics.sampledAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('getWorkerHealth returns unavailable when the heartbeat is missing', async (t) => {
  withAlertEnv(t, {
    WORKER_HEARTBEAT_KEY: 'vcloudrunner:test:worker:heartbeat',
    WORKER_HEARTBEAT_STALE_MS: 45000
  });

  const service = createService({ heartbeat: null });
  const health = await service.getWorkerHealth();

  assert.deepEqual(health, {
    status: 'unavailable',
    heartbeatKey: 'vcloudrunner:test:worker:heartbeat',
    staleAfterMs: 45000,
    message: 'Worker heartbeat not found'
  });
});

test('getWorkerHealth returns unavailable for invalid heartbeat payloads', async (t) => {
  withAlertEnv(t, {
    WORKER_HEARTBEAT_KEY: 'vcloudrunner:test:worker:heartbeat',
    WORKER_HEARTBEAT_STALE_MS: 45000
  });

  const invalidJsonService = createService({ heartbeat: '{not-json' });
  const invalidJsonHealth = await invalidJsonService.getWorkerHealth();
  assert.equal(invalidJsonHealth.status, 'unavailable');
  assert.equal(invalidJsonHealth.message, 'Worker heartbeat payload is invalid JSON');

  const invalidTimestampService = createService({
    heartbeat: JSON.stringify({ timestamp: 'not-a-date' })
  });
  const invalidTimestampHealth = await invalidTimestampService.getWorkerHealth();
  assert.equal(invalidTimestampHealth.status, 'unavailable');
  assert.equal(
    invalidTimestampHealth.message,
    'Worker heartbeat payload is missing a valid timestamp'
  );
});

test('getWorkerHealth returns stale when the heartbeat is older than the configured threshold', async (t) => {
  withAlertEnv(t, {
    WORKER_HEARTBEAT_KEY: 'vcloudrunner:test:worker:heartbeat',
    WORKER_HEARTBEAT_STALE_MS: 1000
  });

  const staleTimestamp = new Date(Date.now() - 5000).toISOString();
  const service = createService({
    heartbeat: JSON.stringify({
      timestamp: staleTimestamp,
      service: 'worker',
      pid: 1234
    })
  });

  const health = await service.getWorkerHealth();

  assert.equal(health.status, 'stale');
  assert.equal(health.heartbeatKey, 'vcloudrunner:test:worker:heartbeat');
  assert.equal(health.staleAfterMs, 1000);
  assert.equal(health.timestamp, staleTimestamp);
  assert.equal(health.service, 'worker');
  assert.equal(health.pid, 1234);
  assert.ok((health.ageMs ?? 0) >= 5000);
});

test('sendAlert posts webhook payloads once per cooldown window', async (t) => {
  withAlertEnv(t, {
    ALERT_WEBHOOK_URL: 'https://alerts.example.test/webhook',
    ALERT_WEBHOOK_AUTH_TOKEN: 'alert-secret-token',
    ALERT_COOLDOWN_MS: 60_000
  });

  const service = createService();
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  t.mock.method(
    globalThis,
    'fetch',
    async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 204 });
    }
  );

  await service.sendAlert({
    key: 'worker-health:stale',
    severity: 'critical',
    message: 'Worker health degraded',
    details: { status: 'stale' }
  });
  await service.sendAlert({
    key: 'worker-health:stale',
    severity: 'critical',
    message: 'Worker health degraded',
    details: { status: 'stale' }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://alerts.example.test/webhook');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal(calls[0]?.init?.headers && (calls[0].init.headers as Record<string, string>).authorization, 'Bearer alert-secret-token');
  assert.ok(calls[0]?.init?.signal instanceof AbortSignal);
  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(body.source, 'api');
  assert.equal(body.key, 'worker-health:stale');
  assert.equal(body.severity, 'critical');
});

test('sendAlert wraps webhook network failures with an actionable message', async (t) => {
  withAlertEnv(t, {
    ALERT_WEBHOOK_URL: 'https://alerts.example.test/webhook',
    ALERT_WEBHOOK_AUTH_TOKEN: ''
  });

  const service = createService();

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('socket hang up');
  });

  await assert.rejects(
    service.sendAlert({
      key: 'worker-health:stale',
      severity: 'critical',
      message: 'Worker health degraded',
      details: { status: 'stale' }
    }),
    /alert webhook request failed: socket hang up/
  );
});

test('sendAlert normalizes webhook timeout failures with an actionable message', async (t) => {
  withAlertEnv(t, {
    ALERT_WEBHOOK_URL: 'https://alerts.example.test/webhook',
    ALERT_WEBHOOK_AUTH_TOKEN: ''
  });

  const service = createService();
  const timeoutHandle = { timeout: true } as unknown as ReturnType<typeof setTimeout>;

  t.mock.method(globalThis, 'setTimeout', (((handler: () => void) => {
    handler();
    return timeoutHandle;
  }) as unknown) as typeof setTimeout);
  t.mock.method(globalThis, 'clearTimeout', (() => undefined) as typeof clearTimeout);
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if ((init?.signal as AbortSignal | undefined)?.aborted) {
        throw new Error('aborted by signal');
      }

      throw new Error('expected timeout abort');
    }
  );

  await assert.rejects(
    service.sendAlert({
      key: 'worker-health:stale',
      severity: 'critical',
      message: 'Worker health degraded',
      details: { status: 'stale' }
    }),
    /alert webhook request timed out after 10000ms/
  );
});

test('evaluateOperationalAlerts emits alerts for degraded worker health and queue threshold breaches', async (t) => {
  withAlertEnv(t, {
    ALERT_QUEUE_WAITING_THRESHOLD: 5,
    ALERT_QUEUE_ACTIVE_THRESHOLD: 3,
    ALERT_QUEUE_FAILED_THRESHOLD: 2,
    WORKER_HEARTBEAT_STALE_MS: 1000
  });

  const service = createService({
    counts: {
      waiting: 7,
      active: 4,
      completed: 10,
      failed: 3,
      delayed: 0,
      paused: 0,
      prioritized: 0
    },
    heartbeat: JSON.stringify({
      timestamp: new Date(Date.now() - 5000).toISOString(),
      service: 'worker',
      pid: 4321
    })
  });

  const alerts: Array<{ key: string; severity: string; message: string }> = [];
  t.mock.method(
    service,
    'sendAlert',
    async (payload: Parameters<AlertMonitorService['sendAlert']>[0]) => {
    alerts.push({
      key: payload.key,
      severity: payload.severity,
      message: payload.message
    });
    }
  );

  await service.evaluateOperationalAlerts();

  assert.deepEqual(alerts, [
    {
      key: 'worker-health:stale',
      severity: 'critical',
      message: 'Worker health degraded'
    },
    {
      key: 'queue-waiting-threshold',
      severity: 'warn',
      message: 'Deployment queue waiting backlog exceeded threshold'
    },
    {
      key: 'queue-active-threshold',
      severity: 'warn',
      message: 'Deployment queue active jobs exceeded threshold'
    },
    {
      key: 'queue-failed-threshold',
      severity: 'critical',
      message: 'Deployment queue failed jobs exceeded threshold'
    }
  ]);
});

test('start is idempotent until stop is called, then schedules again', async (t) => {
  withAlertEnv(t, {
    ALERT_MONITOR_INTERVAL_MS: 30_000
  } as Partial<typeof env>);

  const service = createService();
  const timerA = { timer: 'a' } as unknown as ReturnType<typeof setInterval>;
  const timerB = { timer: 'b' } as unknown as ReturnType<typeof setInterval>;
  const timers: Array<ReturnType<typeof setInterval>> = [timerA, timerB];
  const setIntervalCalls: Array<{ handler: () => void; delay?: number }> = [];
  const clearedTimers: Array<ReturnType<typeof setInterval>> = [];
  let evaluationCalls = 0;

  t.mock.method(
    globalThis,
    'setInterval',
    ((handler: () => void, delay?: number) => {
      setIntervalCalls.push({ handler, delay });
      return timers[setIntervalCalls.length - 1]!;
    }) as typeof setInterval
  );
  t.mock.method(globalThis, 'clearInterval', ((timer: ReturnType<typeof setInterval>) => {
    clearedTimers.push(timer);
  }) as typeof clearInterval);
  t.mock.method(service, 'evaluateOperationalAlerts', async () => {
    evaluationCalls += 1;
  });

  service.start();
  service.start();
  await Promise.resolve();

  assert.equal(setIntervalCalls.length, 1);
  assert.equal(setIntervalCalls[0]?.delay, 30_000);
  assert.equal(evaluationCalls, 1);

  service.stop();
  assert.deepEqual(clearedTimers, [timerA]);

  service.start();
  await Promise.resolve();

  assert.equal(setIntervalCalls.length, 2);
  assert.equal(evaluationCalls, 2);
});

test('start logs initial and interval evaluation failures without throwing', async (t) => {
  withAlertEnv(t, {
    ALERT_MONITOR_INTERVAL_MS: 30_000
  } as Partial<typeof env>);

  const warnings: Array<{ obj: Record<string, unknown>; msg: string }> = [];
  const service = createService({
    logger: {
      warn: (obj, msg) => {
        warnings.push({ obj, msg });
      }
    }
  });

  const intervalHandlers: Array<() => void> = [];

  t.mock.method(
    globalThis,
    'setInterval',
    ((handler: () => void) => {
      intervalHandlers.push(handler);
      return { timer: 'warn-test' } as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval
  );

  t.mock.method(service, 'evaluateOperationalAlerts', async () => {
    throw new Error('boom');
  });

  service.start();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.msg, 'initial operational alert evaluation failed');
  assert.ok(warnings[0]?.obj.error instanceof Error);

  const registeredIntervalHandler = intervalHandlers[0];
  if (!registeredIntervalHandler) {
    throw new Error('expected interval handler to be registered');
  }
  registeredIntervalHandler();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(warnings.length, 2);
  assert.equal(warnings[1]?.msg, 'operational alert evaluation failed');
  assert.ok(warnings[1]?.obj.error instanceof Error);
});

test('start skips overlapping alert evaluations until the active run settles', async (t) => {
  withAlertEnv(t, {
    ALERT_MONITOR_INTERVAL_MS: 30_000
  } as Partial<typeof env>);

  const service = createService();
  const intervalHandlers: Array<() => void> = [];
  let evaluationCalls = 0;
  let releaseEvaluation: (() => void) | undefined;
  const firstEvaluation = new Promise<void>((resolve) => {
    releaseEvaluation = resolve;
  });

  t.mock.method(
    globalThis,
    'setInterval',
    ((handler: () => void) => {
      intervalHandlers.push(handler);
      return { timer: 'overlap-test' } as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval
  );

  t.mock.method(service, 'evaluateOperationalAlerts', async () => {
    evaluationCalls += 1;
    if (evaluationCalls === 1) {
      await firstEvaluation;
    }
  });

  service.start();
  await Promise.resolve();

  assert.equal(evaluationCalls, 1);

  const registeredIntervalHandler = intervalHandlers[0];
  if (!registeredIntervalHandler) {
    throw new Error('expected interval handler to be registered');
  }

  registeredIntervalHandler();
  await Promise.resolve();
  assert.equal(evaluationCalls, 1);

  releaseEvaluation?.();
  await Promise.resolve();
  await Promise.resolve();

  registeredIntervalHandler();
  await Promise.resolve();
  assert.equal(evaluationCalls, 2);
});
