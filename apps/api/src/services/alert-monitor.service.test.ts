import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

import { env } from '../config/env.js';
import { AlertMonitorService } from './alert-monitor.service.js';

type JobCounts = Record<string, number>;

class MockQueue {
  constructor(private readonly counts: JobCounts) {}

  async getJobCounts(..._statuses: string[]) {
    return this.counts;
  }
}

class MockRedis {
  constructor(private readonly heartbeat: string | null) {}

  async get(_key: string) {
    return this.heartbeat;
  }
}

function createService(options?: {
  counts?: JobCounts;
  heartbeat?: string | null;
}) {
  const logger = {
    warn: (_obj: Record<string, unknown>, _msg: string) => {}
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
  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(body.source, 'api');
  assert.equal(body.key, 'worker-health:stale');
  assert.equal(body.severity, 'critical');
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
