import { UnrecoverableError, Worker } from 'bullmq';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { redisConnection } from '../queue/redis.js';
import { CaddyService } from '../services/caddy.service.js';
import { DeploymentRunner } from '../services/deployment-runner.js';
import { DeploymentStateService } from '../services/deployment-state.service.js';
import { isNonRetryableDeploymentError, remainingAttempts } from './deployment-worker.utils.js';

const runner = new DeploymentRunner();
const stateService = new DeploymentStateService();
const caddyService = new CaddyService();

export const deploymentWorker = new Worker<DeploymentJobPayload>(
  QUEUE_NAMES.deployment,
  async (job) => {
    logger.info('deployment job received', { jobId: job.id, deploymentId: job.data.deploymentId, attempt: job.attemptsMade + 1 });
    await stateService.markBuilding(job.data.deploymentId);

    await stateService.appendLog(job.data.deploymentId, `Deployment started (attempt ${job.attemptsMade + 1})`);

    try {
      const result = await runner.run(job.data);

      if (result.hostPort !== null) {
        const host = `${job.data.projectSlug}.${env.PLATFORM_DOMAIN}`;
        await caddyService.upsertRoute({ host, upstreamPort: result.hostPort });
        await stateService.appendLog(job.data.deploymentId, `Route configured for ${host}`);
      }

      await stateService.markRunning({
        deploymentId: job.data.deploymentId,
        projectId: job.data.projectId,
        projectSlug: job.data.projectSlug,
        containerId: result.containerId,
        imageTag: result.imageTag,
        hostPort: result.hostPort,
        internalPort: result.internalPort,
        runtimeUrl: result.runtimeUrl
      });

      await stateService.appendLog(
        job.data.deploymentId,
        `Deployment running. Container ${result.containerName} on port ${result.hostPort ?? 'unknown'}`
      );

      logger.info('deployment finished', {
        deploymentId: job.data.deploymentId,
        containerId: result.containerId,
        hostPort: result.hostPort,
        attempt: job.attemptsMade + 1
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown deployment failure';
      const nonRetryable = isNonRetryableDeploymentError(message);
      const retriesRemaining = remainingAttempts(job);

      if (nonRetryable) {
        await stateService.markFailed(job.data.deploymentId, message);
        logger.error('deployment failed (non-retryable)', {
          deploymentId: job.data.deploymentId,
          message,
          attempt: job.attemptsMade + 1
        });
        throw new UnrecoverableError(message);
      }

      if (retriesRemaining > 0) {
        await stateService.appendLog(
          job.data.deploymentId,
          `Attempt ${job.attemptsMade + 1} failed. Retrying (${retriesRemaining} retries left). Error: ${message}`,
          'warn'
        );

        logger.warn('deployment attempt failed; retry scheduled', {
          deploymentId: job.data.deploymentId,
          message,
          attempt: job.attemptsMade + 1,
          retriesRemaining
        });
        throw error;
      }

      await stateService.markFailed(job.data.deploymentId, message);
      logger.error('deployment failed (retries exhausted)', {
        deploymentId: job.data.deploymentId,
        message,
        attempt: job.attemptsMade + 1
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2
  }
);
