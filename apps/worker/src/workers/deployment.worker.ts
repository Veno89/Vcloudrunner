import { UnrecoverableError, Worker } from 'bullmq';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { redisConnection } from '../queue/redis.js';
import { CaddyService } from '../services/caddy.service.js';
import { createRuntimeExecutor } from '../services/runtime/runtime-executor.factory.js';
import { DeploymentStateService } from '../services/deployment-state.service.js';
import { DeploymentFailure, classifyDeploymentFailure } from './deployment-errors.js';
import { remainingAttempts } from './deployment-worker.utils.js';
import { emitDeploymentEvent } from '../services/deployment-events.js';

const runtimeExecutor = createRuntimeExecutor();
const stateService = new DeploymentStateService();
const caddyService = new CaddyService();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new DeploymentFailure('DEPLOYMENT_TIMEOUT', `DEPLOYMENT_TIMEOUT_EXCEEDED: deployment exceeded ${timeoutMs}ms`, false));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export const deploymentWorker = new Worker<DeploymentJobPayload>(
  QUEUE_NAMES.deployment,
  async (job) => {
    const correlationId = job.data.correlationId ?? `queue-job:${job.id ?? 'unknown'}`;

    if (await stateService.isCancellationRequested(job.data.deploymentId)) {
      await stateService.markStopped(
        job.data.deploymentId,
        `Deployment cancelled before worker execution (correlation ${correlationId}).`
      );
      emitDeploymentEvent({ type: 'deployment.cancelled', deploymentId: job.data.deploymentId, projectId: job.data.projectId, projectSlug: job.data.projectSlug, correlationId, timestamp: new Date().toISOString() });
      logger.info('deployment cancelled before execution', {
        deploymentId: job.data.deploymentId,
        correlationId,
        attempt: job.attemptsMade + 1
      });
      return;
    }

    logger.info('deployment job received', {
      jobId: job.id,
      deploymentId: job.data.deploymentId,
      correlationId,
      attempt: job.attemptsMade + 1
    });
    await stateService.markBuilding(job.data.deploymentId);
    emitDeploymentEvent({ type: 'deployment.building', deploymentId: job.data.deploymentId, projectId: job.data.projectId, projectSlug: job.data.projectSlug, correlationId, timestamp: new Date().toISOString() });

    await stateService.appendLog(
      job.data.deploymentId,
      `Deployment started (attempt ${job.attemptsMade + 1}, correlation ${correlationId})`
    );
    await stateService.appendLog(
      job.data.deploymentId,
      `Deployment timeout is set to ${Math.floor(env.DEPLOYMENT_EXECUTION_TIMEOUT_MS / 1000)} seconds`
    );

    try {
      const result = await withTimeout(runtimeExecutor.run(job.data), env.DEPLOYMENT_EXECUTION_TIMEOUT_MS);

      if (await stateService.isCancellationRequested(job.data.deploymentId)) {
        await runtimeExecutor.cleanupCancelledRun({
          deploymentId: job.data.deploymentId,
          containerId: result.containerId,
          imageTag: result.imageTag
        });
        await stateService.markStopped(
          job.data.deploymentId,
          `Deployment cancelled during build execution (correlation ${correlationId}).`
        );
        logger.info('deployment cancelled during execution', {
          deploymentId: job.data.deploymentId,
          correlationId,
          attempt: job.attemptsMade + 1
        });
        return;
      }

      if (result.hostPort !== null) {
        const host = `${job.data.projectSlug}.${env.PLATFORM_DOMAIN}`;
        try {
          await caddyService.upsertRoute({ host, upstreamPort: result.hostPort });
          await stateService.appendLog(job.data.deploymentId, `Route configured for ${host}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('failed to configure caddy route; continuing deployment', {
            deploymentId: job.data.deploymentId,
            correlationId,
            host,
            upstreamPort: result.hostPort,
            message
          });
          await stateService.appendLog(
            job.data.deploymentId,
            `Route configuration skipped (${message}). Container remains available on mapped port ${result.hostPort}.`,
            'warn'
          );
        }
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
      emitDeploymentEvent({ type: 'deployment.running', deploymentId: job.data.deploymentId, projectId: job.data.projectId, projectSlug: job.data.projectSlug, correlationId, timestamp: new Date().toISOString(), details: { containerId: result.containerId, hostPort: result.hostPort } });

      logger.info('deployment finished', {
        deploymentId: job.data.deploymentId,
        correlationId,
        containerId: result.containerId,
        hostPort: result.hostPort,
        attempt: job.attemptsMade + 1
      });
    } catch (error) {
      if (await stateService.isCancellationRequested(job.data.deploymentId)) {
        await stateService.markStopped(
          job.data.deploymentId,
          `Deployment cancellation confirmed after execution error (correlation ${correlationId}).`
        );
        logger.info('deployment cancellation finalized after execution error', {
          deploymentId: job.data.deploymentId,
          correlationId,
          attempt: job.attemptsMade + 1
        });
        return;
      }

      const failure = classifyDeploymentFailure(error);
      const retriesRemaining = remainingAttempts(job);

      if (!failure.retryable) {
        await stateService.markFailed(job.data.deploymentId, `[${failure.code}] ${failure.message}`);
        emitDeploymentEvent({ type: 'deployment.failed', deploymentId: job.data.deploymentId, projectId: job.data.projectId, projectSlug: job.data.projectSlug, correlationId, timestamp: new Date().toISOString(), details: { code: failure.code, message: failure.message } });
        logger.error('deployment failed (non-retryable)', {
          deploymentId: job.data.deploymentId,
          correlationId,
          code: failure.code,
          message: failure.message,
          attempt: job.attemptsMade + 1
        });
        throw new UnrecoverableError(failure.message);
      }

      if (retriesRemaining > 0) {
        await stateService.appendLog(
          job.data.deploymentId,
          `Attempt ${job.attemptsMade + 1} failed. Retrying (${retriesRemaining} retries left). Error: [${failure.code}] ${failure.message}`,
          'warn'
        );

        logger.warn('deployment attempt failed; retry scheduled', {
          deploymentId: job.data.deploymentId,
          correlationId,
          code: failure.code,
          message: failure.message,
          attempt: job.attemptsMade + 1,
          retriesRemaining
        });
        throw error;
      }

      await stateService.markFailed(job.data.deploymentId, `[${failure.code}] ${failure.message}`);
      emitDeploymentEvent({ type: 'deployment.failed', deploymentId: job.data.deploymentId, projectId: job.data.projectId, projectSlug: job.data.projectSlug, correlationId, timestamp: new Date().toISOString(), details: { code: failure.code, message: failure.message, retriesExhausted: true } });
      logger.error('deployment failed (retries exhausted)',' {
        deploymentId: job.data.deploymentId,
        correlationId,
        code: failure.code,
        message: failure.message,
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
