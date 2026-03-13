import type { Redis } from 'ioredis';
import type { Queue } from 'bullmq';

import { env } from '../config/env.js';

interface WorkerHeartbeat {
  timestamp: string;
  service?: string;
  pid?: number;
}

interface AlertPayload {
  key: string;
  severity: 'warn' | 'critical';
  message: string;
  details: Record<string, unknown>;
}

export interface QueueMetrics {
  queue: string;
  counts: Record<string, number>;
  sampledAt: string;
}

export interface WorkerHealthResult {
  status: 'ok' | 'stale' | 'unavailable';
  heartbeatKey: string;
  staleAfterMs: number;
  ageMs?: number;
  timestamp?: string;
  service?: string;
  pid?: number | null;
  message?: string;
}

export class AlertMonitorService {
  private readonly lastAlertAtByKey = new Map<string, number>();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly queue: Queue,
    private readonly redis: Redis,
    private readonly queueName: string,
    private readonly logger: { warn: (obj: Record<string, unknown>, msg: string) => void }
  ) {}

  async getQueueMetrics(): Promise<QueueMetrics> {
    const counts = await this.queue.getJobCounts(
      'waiting', 'active', 'completed', 'failed', 'delayed', 'paused', 'prioritized'
    );
    return { queue: this.queueName, counts, sampledAt: new Date().toISOString() };
  }

  async getWorkerHealth(): Promise<WorkerHealthResult> {
    const rawHeartbeat = await this.redis.get(env.WORKER_HEARTBEAT_KEY);
    if (!rawHeartbeat) {
      return {
        status: 'unavailable',
        heartbeatKey: env.WORKER_HEARTBEAT_KEY,
        staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
        message: 'Worker heartbeat not found',
      };
    }

    let heartbeat: WorkerHeartbeat;
    try {
      heartbeat = JSON.parse(rawHeartbeat) as WorkerHeartbeat;
    } catch {
      return {
        status: 'unavailable',
        heartbeatKey: env.WORKER_HEARTBEAT_KEY,
        staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
        message: 'Worker heartbeat payload is invalid JSON',
      };
    }

    const parsedTimestamp = Date.parse(heartbeat.timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      return {
        status: 'unavailable',
        heartbeatKey: env.WORKER_HEARTBEAT_KEY,
        staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
        message: 'Worker heartbeat payload is missing a valid timestamp',
      };
    }

    const ageMs = Date.now() - parsedTimestamp;
    return {
      status: ageMs <= env.WORKER_HEARTBEAT_STALE_MS ? 'ok' : 'stale',
      heartbeatKey: env.WORKER_HEARTBEAT_KEY,
      staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
      ageMs,
      timestamp: heartbeat.timestamp,
      service: heartbeat.service ?? 'worker',
      pid: heartbeat.pid ?? null,
    };
  }

  async sendAlert(payload: AlertPayload): Promise<void> {
    const webhookUrl = env.ALERT_WEBHOOK_URL.trim();
    if (webhookUrl.length === 0) return;

    const now = Date.now();
    const lastAlertAt = this.lastAlertAtByKey.get(payload.key);
    if (typeof lastAlertAt === 'number' && now - lastAlertAt < env.ALERT_COOLDOWN_MS) return;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.ALERT_WEBHOOK_AUTH_TOKEN.trim().length > 0
          ? { authorization: `Bearer ${env.ALERT_WEBHOOK_AUTH_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ source: 'api', ...payload, timestamp: new Date().toISOString() }),
    });

    if (!response.ok) {
      throw new Error(`alert webhook responded with status ${response.status}`);
    }

    this.lastAlertAtByKey.set(payload.key, now);
  }

  async evaluateOperationalAlerts(): Promise<void> {
    const queueMetrics = await this.getQueueMetrics();
    const workerHealth = await this.getWorkerHealth();

    if (workerHealth.status !== 'ok') {
      await this.sendAlert({
        key: `worker-health:${workerHealth.status}`,
        severity: 'critical',
        message: 'Worker health degraded',
        details: workerHealth as unknown as Record<string, unknown>,
      });
    }

    if (queueMetrics.counts.waiting >= env.ALERT_QUEUE_WAITING_THRESHOLD) {
      await this.sendAlert({
        key: 'queue-waiting-threshold',
        severity: 'warn',
        message: 'Deployment queue waiting backlog exceeded threshold',
        details: { waiting: queueMetrics.counts.waiting, threshold: env.ALERT_QUEUE_WAITING_THRESHOLD, queue: queueMetrics.queue },
      });
    }

    if (queueMetrics.counts.active >= env.ALERT_QUEUE_ACTIVE_THRESHOLD) {
      await this.sendAlert({
        key: 'queue-active-threshold',
        severity: 'warn',
        message: 'Deployment queue active jobs exceeded threshold',
        details: { active: queueMetrics.counts.active, threshold: env.ALERT_QUEUE_ACTIVE_THRESHOLD, queue: queueMetrics.queue },
      });
    }

    if (queueMetrics.counts.failed >= env.ALERT_QUEUE_FAILED_THRESHOLD) {
      await this.sendAlert({
        key: 'queue-failed-threshold',
        severity: 'critical',
        message: 'Deployment queue failed jobs exceeded threshold',
        details: { failed: queueMetrics.counts.failed, threshold: env.ALERT_QUEUE_FAILED_THRESHOLD, queue: queueMetrics.queue },
      });
    }
  }

  start(): void {
    this.intervalId = setInterval(() => {
      void this.evaluateOperationalAlerts().catch((error) => {
        this.logger.warn({ error }, 'operational alert evaluation failed');
      });
    }, env.ALERT_MONITOR_INTERVAL_MS);

    void this.evaluateOperationalAlerts().catch((error) => {
      this.logger.warn({ error }, 'initial operational alert evaluation failed');
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
