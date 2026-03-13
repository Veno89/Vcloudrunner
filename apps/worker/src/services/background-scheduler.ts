import type { Redis } from 'ioredis';
import type { DeploymentStateService } from './deployment-state.service.js';
import { env } from '../config/env.js';
import { logger as defaultLogger } from '../logger/logger.js';

type Logger = typeof defaultLogger;

interface ScheduledTask {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  timer?: ReturnType<typeof setInterval>;
}

export class BackgroundScheduler {
  private tasks: ScheduledTask[] = [];

  constructor(
    private readonly stateService: DeploymentStateService,
    private readonly heartbeatRedis: Redis,
    private readonly logger: Logger
  ) {
    this.registerTasks();
  }

  private registerTasks(): void {
    this.tasks = [
      {
        name: 'log-retention',
        intervalMs: env.DEPLOYMENT_LOG_PRUNE_INTERVAL_MS,
        handler: () => this.stateService.pruneLogsByRetentionWindow().then(() => undefined),
      },
      {
        name: 'log-archive',
        intervalMs: env.DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS,
        handler: async () => {
          const count = await this.stateService.archiveEligibleDeploymentLogs();
          if (count > 0) this.logger.info('deployment log archive sweep completed', { archivedCount: count });
        },
      },
      {
        name: 'archive-upload',
        intervalMs: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_INTERVAL_MS,
        handler: async () => {
          const count = await this.stateService.uploadPendingArchives();
          if (count > 0) this.logger.info('deployment log archive upload sweep completed', { uploadedCount: count });
        },
      },
      {
        name: 'archive-cleanup',
        intervalMs: env.DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS,
        handler: async () => {
          const count = await this.stateService.cleanupArchivedArtifacts();
          if (count > 0) this.logger.info('deployment log archive cleanup sweep completed', { deletedCount: count });
        },
      },
      {
        name: 'stuck-recovery',
        intervalMs: env.DEPLOYMENT_STUCK_RECOVERY_INTERVAL_MS,
        handler: async () => {
          const count = await this.stateService.recoverStuckDeployments();
          if (count > 0) this.logger.warn('stuck deployment recovery sweep completed', { recoveredCount: count });
        },
      },
      {
        name: 'heartbeat',
        intervalMs: env.WORKER_HEARTBEAT_INTERVAL_MS,
        handler: () => this.publishHeartbeat(),
      },
    ];
  }

  async publishHeartbeat(): Promise<void> {
    await this.heartbeatRedis.set(
      env.WORKER_HEARTBEAT_KEY,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'worker',
        pid: process.pid,
      }),
      'EX',
      env.WORKER_HEARTBEAT_TTL_SECONDS
    );
  }

  start(): void {
    for (const task of this.tasks) {
      task.timer = setInterval(() => {
        void task.handler().catch((error) => {
          this.logger.warn(`${task.name} background task failed`, {
            message: error instanceof Error ? error.message : String(error),
          });
        });
      }, task.intervalMs);
    }
  }

  async stop(): Promise<void> {
    for (const task of this.tasks) {
      if (task.timer) clearInterval(task.timer);
    }
    await this.heartbeatRedis.del(env.WORKER_HEARTBEAT_KEY).catch(() => undefined);
    await this.heartbeatRedis.quit().catch(() => undefined);
  }
}
