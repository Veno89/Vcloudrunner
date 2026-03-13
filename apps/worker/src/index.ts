import { logger } from './logger/logger.js';
import { env } from './config/env.js';
import { DeploymentStateService } from './services/deployment-state.service.js';
import { BackgroundScheduler } from './services/background-scheduler.js';
import { deploymentWorker } from './workers/deployment.worker.js';
import { Redis } from 'ioredis';
import Docker from 'dockerode';

const stateService = new DeploymentStateService();
const docker = new Docker({ socketPath: env.DOCKER_SOCKET_PATH });
const heartbeatRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const scheduler = new BackgroundScheduler(stateService, heartbeatRedis, logger);

deploymentWorker.on('ready', () => {
  logger.info('deployment worker ready');
  void scheduler.publishHeartbeat().catch((error) => {
    logger.warn('worker heartbeat publish failed', {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  void stateService.reconcileRunningDeployments(async (containerId) => {
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

  scheduler.start();
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

const stopSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of stopSignals) {
  process.on(signal, async () => {
    logger.info(`received ${signal}, shutting down worker`);
    await scheduler.stop();
    await deploymentWorker.close();
    process.exit(0);
  });
}
