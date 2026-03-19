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

const ALERT_WEBHOOK_TIMEOUT_MS = 10_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
  private evaluationInFlight = false;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, ALERT_WEBHOOK_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(env.ALERT_WEBHOOK_AUTH_TOKEN.trim().length > 0
            ? { authorization: `Bearer ${env.ALERT_WEBHOOK_AUTH_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({ source: 'api', ...payload, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      });
    } catch (error) {
      throw controller.signal.aborted
        ? new Error(`alert webhook request timed out after ${ALERT_WEBHOOK_TIMEOUT_MS}ms`)
        : new Error(`alert webhook request failed: ${getErrorMessage(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`alert webhook responded with status ${response.status}`);
    }

    this.lastAlertAtByKey.set(payload.key, now);
  }

  private async deliverAlert(payload: AlertPayload): Promise<void> {
    try {
      await this.sendAlert(payload);
    } catch (error) {
      this.logger.warn(
        {
          error,
          key: payload.key,
          severity: payload.severity
        },
        'operational alert delivery failed'
      );
    }
  }

  async evaluateOperationalAlerts(): Promise<void> {
    const queueMetrics = await this.getQueueMetrics();
    const workerHealth = await this.getWorkerHealth();

    if (workerHealth.status !== 'ok') {
      await this.deliverAlert({
        key: `worker-health:${workerHealth.status}`,
        severity: 'critical',
        message: 'Worker health degraded',
        details: workerHealth as unknown as Record<string, unknown>,
      });
    }

    if (queueMetrics.counts.waiting >= env.ALERT_QUEUE_WAITING_THRESHOLD) {
      await this.deliverAlert({
        key: 'queue-waiting-threshold',
        severity: 'warn',
        message: 'Deployment queue waiting backlog exceeded threshold',
        details: { waiting: queueMetrics.counts.waiting, threshold: env.ALERT_QUEUE_WAITING_THRESHOLD, queue: queueMetrics.queue },
      });
    }

    if (queueMetrics.counts.active >= env.ALERT_QUEUE_ACTIVE_THRESHOLD) {
      await this.deliverAlert({
        key: 'queue-active-threshold',
        severity: 'warn',
        message: 'Deployment queue active jobs exceeded threshold',
        details: { active: queueMetrics.counts.active, threshold: env.ALERT_QUEUE_ACTIVE_THRESHOLD, queue: queueMetrics.queue },
      });
    }

    if (queueMetrics.counts.failed >= env.ALERT_QUEUE_FAILED_THRESHOLD) {
      await this.deliverAlert({
        key: 'queue-failed-threshold',
        severity: 'critical',
        message: 'Deployment queue failed jobs exceeded threshold',
        details: { failed: queueMetrics.counts.failed, threshold: env.ALERT_QUEUE_FAILED_THRESHOLD, queue: queueMetrics.queue },
      });
    }
  }

  private async evaluateWithGuard(failureMessage: string): Promise<void> {
    if (this.evaluationInFlight) {
      return;
    }

    this.evaluationInFlight = true;

    try {
      await this.evaluateOperationalAlerts();
    } catch (error) {
      this.logger.warn({ error }, failureMessage);
    } finally {
      this.evaluationInFlight = false;
    }
  }

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      void this.evaluateWithGuard('operational alert evaluation failed');
    }, env.ALERT_MONITOR_INTERVAL_MS);

    void this.evaluateWithGuard('initial operational alert evaluation failed');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
