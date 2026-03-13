import { logger } from './logger/logger.js';
import { env } from './config/env.js';
import { DeploymentStateService } from './services/deployment-state.service.js';
import { deploymentWorker } from './workers/deployment.worker.js';
import { Redis } from 'ioredis';
import Docker from 'dockerode';

const retentionService = new DeploymentStateService();
const docker = new Docker({ socketPath: env.DOCKER_SOCKET_PATH });
const heartbeatRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

async function publishWorkerHeartbeat() {
  await heartbeatRedis.set(
    env.WORKER_HEARTBEAT_KEY,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'worker',
      pid: process.pid
    }),
    'EX',
    env.WORKER_HEARTBEAT_TTL_SECONDS
  );
}

deploymentWorker.on('ready', () => {
  logger.info('deployment worker ready');
  void publishWorkerHeartbeat().catch((error) => {
    logger.warn('worker heartbeat publish failed', {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  void retentionService.reconcileRunningDeployments(async (containerId) => {
    try {
      const info = await docker.getContainer(containerId).inspect();
      return info.State.Running === true;
    } catch {
      return false;
    }
  }).then((reconciledCount) => {
    if (reconciledCount > 0) {
      logger.warn('startup state reconciliation completed', { reconciledCount });
    } else {
      logger.info('startup state reconciliation: all running deployments verified');
    }
  }).catch((error) => {
    logger.error('startup state reconciliation failed', {
      message: error instanceof Error ? error.message : String(error)
    });
  });
});

deploymentWorker.on('completed', (job) => {
  logger.info('job completed', {
    jobId: job.id,
    deploymentId: job.data.deploymentId,
    correlationId: job.data.correlationId ?? `queue-job:${job.id ?? 'unknown'}`
  });
});

deploymentWorker.on('failed', (job, error) => {
  logger.error('job failed', {
    jobId: job?.id,
    deploymentId: job?.data.deploymentId,
    correlationId: job?.data.correlationId ?? `queue-job:${job?.id ?? 'unknown'}`,
    message: error.message
  });
});

const retentionInterval = setInterval(() => {
  void retentionService.pruneLogsByRetentionWindow().catch((error) => {
    logger.warn('deployment log retention prune failed', {
      message: error instanceof Error ? error.message : String(error)
    });
  });
}, env.DEPLOYMENT_LOG_PRUNE_INTERVAL_MS);

const archiveInterval = setInterval(() => {
  void retentionService.archiveEligibleDeploymentLogs()
    .then((archivedCount) => {
      if (archivedCount > 0) {
        logger.info('deployment log archive sweep completed', { archivedCount });
      }
    })
    .catch((error) => {
      logger.warn('deployment log archive sweep failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
}, env.DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS);

const archiveUploadInterval = setInterval(() => {
  void retentionService.uploadPendingArchives()
    .then((uploadedCount) => {
      if (uploadedCount > 0) {
        logger.info('deployment log archive upload sweep completed', { uploadedCount });
      }
    })
    .catch((error) => {
      logger.warn('deployment log archive upload sweep failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
}, env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_INTERVAL_MS);


const archiveCleanupInterval = setInterval(() => {
  void retentionService.cleanupArchivedArtifacts()
    .then((deletedCount) => {
      if (deletedCount > 0) {
        logger.info('deployment log archive cleanup sweep completed', { deletedCount });
      }
    })
    .catch((error) => {
      logger.warn('deployment log archive cleanup sweep failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
}, env.DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS);

const stuckRecoveryInterval = setInterval(() => {
  void retentionService.recoverStuckDeployments()
    .then((recoveredCount) => {
      if (recoveredCount > 0) {
        logger.warn('stuck deployment recovery sweep completed', { recoveredCount });
      }
    })
    .catch((error) => {
      logger.warn('stuck deployment recovery sweep failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
}, env.DEPLOYMENT_STUCK_RECOVERY_INTERVAL_MS);

const heartbeatInterval = setInterval(() => {
  void publishWorkerHeartbeat().catch((error) => {
    logger.warn('worker heartbeat publish failed', {
      message: error instanceof Error ? error.message : String(error)
    });
  });
}, env.WORKER_HEARTBEAT_INTERVAL_MS);

const stopSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of stopSignals) {
  process.on(signal, async () => {
    logger.info(`received ${signal}, shutting down worker`);
    clearInterval(retentionInterval);
    clearInterval(archiveInterval);
    clearInterval(archiveUploadInterval);
    clearInterval(archiveCleanupInterval);
    clearInterval(stuckRecoveryInterval);
    clearInterval(heartbeatInterval);
    await heartbeatRedis.del(env.WORKER_HEARTBEAT_KEY).catch(() => undefined);
    await heartbeatRedis.quit().catch(() => undefined);
    await deploymentWorker.close();
    process.exit(0);
  });
}
