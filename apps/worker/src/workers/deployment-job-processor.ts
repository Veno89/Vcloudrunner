import { UnrecoverableError } from 'bullmq';
import type { DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { CaddyService } from '../services/caddy.service.js';
import { emitDeploymentEvent } from '../services/deployment-events.js';
import { DeploymentStateService } from '../services/deployment-state.service.js';
import { createRuntimeExecutor } from '../services/runtime/runtime-executor.factory.js';
import type { RuntimeExecutionResult, RuntimeExecutor } from '../services/runtime/runtime-executor.js';
import { DeploymentFailure, classifyDeploymentFailure } from './deployment-errors.js';
import { remainingAttempts } from './deployment-worker.utils.js';

export interface DeploymentJobLike {
  data: DeploymentJobPayload;
  id?: string | number;
  attemptsMade: number;
  opts: {
    attempts?: number;
  };
}

interface StateServiceLike {
  isCancellationRequested(deploymentId: string): Promise<boolean>;
  markStopped(deploymentId: string, message: string): Promise<void>;
  markBuilding(deploymentId: string): Promise<void>;
  appendLog(deploymentId: string, message: string, level?: string): Promise<void>;
  markRunning(input: {
    deploymentId: string;
    projectId: string;
    projectSlug: string;
    containerId: string;
    imageTag: string;
    hostPort: number | null;
    internalPort: number;
    runtimeUrl: string | null;
  }): Promise<void>;
  markFailed(deploymentId: string, message: string): Promise<void>;
}

interface CaddyServiceLike {
  upsertRoute(input: { host: string; upstreamPort: number }): Promise<void>;
}

interface LoggerLike {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

interface DeploymentJobProcessorDependencies {
  runtimeExecutor?: RuntimeExecutor;
  stateService?: StateServiceLike;
  caddyService?: CaddyServiceLike;
  logger?: LoggerLike;
  emitDeploymentEvent?: typeof emitDeploymentEvent;
}

const defaultDependencies: Required<DeploymentJobProcessorDependencies> = {
  runtimeExecutor: createRuntimeExecutor(),
  stateService: new DeploymentStateService(),
  caddyService: new CaddyService(),
  logger,
  emitDeploymentEvent
};

class CancellationFinalizationError extends Error {
  constructor(public readonly originalError: unknown) {
    super(getErrorMessage(originalError));
    this.name = 'CancellationFinalizationError';
  }
}

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function appendLogBestEffort(
  dependencies: Required<DeploymentJobProcessorDependencies>,
  input: {
    deploymentId: string;
    correlationId: string;
    message: string;
    level?: string;
    stage: 'pre-run' | 'retry-scheduled' | 'route-configured' | 'route-config-skipped' | 'running';
    warningMessage: string;
  }
) {
  try {
    await dependencies.stateService.appendLog(input.deploymentId, input.message, input.level);
  } catch (error) {
    dependencies.logger.warn(input.warningMessage, {
      deploymentId: input.deploymentId,
      correlationId: input.correlationId,
      stage: input.stage,
      message: getErrorMessage(error)
    });
  }
}

function emitDeploymentEventBestEffort(
  dependencies: Required<DeploymentJobProcessorDependencies>,
  input: {
    deploymentId: string;
    correlationId: string;
    event: Parameters<typeof emitDeploymentEvent>[0];
    stage: 'cancelled-before-execution' | 'building' | 'running' | 'failed';
  }
) {
  try {
    dependencies.emitDeploymentEvent(input.event);
  } catch (error) {
    dependencies.logger.warn('deployment event emission failed; continuing deployment', {
      deploymentId: input.deploymentId,
      correlationId: input.correlationId,
      stage: input.stage,
      eventType: input.event.type,
      message: getErrorMessage(error)
    });
  }
}

async function cleanupStartedRuntimeBestEffort(
  dependencies: Required<DeploymentJobProcessorDependencies>,
  input: {
    deploymentId: string;
    correlationId: string;
    result: RuntimeExecutionResult;
    reason: 'post-run-failure' | 'cancellation-after-post-run-failure';
  }
) {
  try {
    await dependencies.runtimeExecutor.cleanupCancelledRun({
      deploymentId: input.deploymentId,
      containerId: input.result.containerId,
      imageTag: input.result.imageTag
    });
  } catch (error) {
    dependencies.logger.warn('deployment runtime cleanup failed after post-run error', {
      deploymentId: input.deploymentId,
      correlationId: input.correlationId,
      reason: input.reason,
      message: getErrorMessage(error)
    });
  }
}

async function markFailedBestEffort(
  dependencies: Required<DeploymentJobProcessorDependencies>,
  input: {
    deploymentId: string;
    correlationId: string;
    prefix: string;
    error: unknown;
    reason:
      | 'cancelled-before-execution-finalization'
      | 'cancelled-during-execution-finalization'
      | 'cancellation-after-error-finalization';
  }
) {
  const message = getErrorMessage(input.error);

  try {
    await dependencies.stateService.markFailed(input.deploymentId, `${input.prefix}: ${message}`);
  } catch (markFailedError) {
    dependencies.logger.warn('deployment failure-state correction failed after cancellation finalization error', {
      deploymentId: input.deploymentId,
      correlationId: input.correlationId,
      reason: input.reason,
      originalMessage: message,
      message: getErrorMessage(markFailedError)
    });
  }
}

export function createDeploymentJobProcessor(
  overrides: DeploymentJobProcessorDependencies = {}
) {
  const dependencies: Required<DeploymentJobProcessorDependencies> = {
    ...defaultDependencies,
    ...overrides
  };

  return async (job: DeploymentJobLike) => {
    const correlationId = job.data.correlationId ?? `queue-job:${job.id ?? 'unknown'}`;
    let runtimeResult: RuntimeExecutionResult | null = null;

    if (await dependencies.stateService.isCancellationRequested(job.data.deploymentId)) {
      try {
        await dependencies.stateService.markStopped(
          job.data.deploymentId,
          `Deployment cancelled before worker execution (correlation ${correlationId}).`
        );
      } catch (error) {
        await markFailedBestEffort(dependencies, {
          deploymentId: job.data.deploymentId,
          correlationId,
          prefix: 'DEPLOYMENT_CANCEL_FINALIZATION_FAILED',
          error,
          reason: 'cancelled-before-execution-finalization'
        });
        throw error;
      }
      emitDeploymentEventBestEffort(dependencies, {
        deploymentId: job.data.deploymentId,
        correlationId,
        stage: 'cancelled-before-execution',
        event: {
          type: 'deployment.cancelled',
          deploymentId: job.data.deploymentId,
          projectId: job.data.projectId,
          projectSlug: job.data.projectSlug,
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
      dependencies.logger.info('deployment cancelled before execution', {
        deploymentId: job.data.deploymentId,
        correlationId,
        attempt: job.attemptsMade + 1
      });
      return;
    }

    dependencies.logger.info('deployment job received', {
      jobId: job.id,
      deploymentId: job.data.deploymentId,
      correlationId,
      attempt: job.attemptsMade + 1
    });
    await dependencies.stateService.markBuilding(job.data.deploymentId);
    emitDeploymentEventBestEffort(dependencies, {
      deploymentId: job.data.deploymentId,
      correlationId,
      stage: 'building',
      event: {
        type: 'deployment.building',
        deploymentId: job.data.deploymentId,
        projectId: job.data.projectId,
        projectSlug: job.data.projectSlug,
        correlationId,
        timestamp: new Date().toISOString()
      }
    });

    await appendLogBestEffort(dependencies, {
      deploymentId: job.data.deploymentId,
      correlationId,
      message: `Deployment started (attempt ${job.attemptsMade + 1}, correlation ${correlationId})`,
      stage: 'pre-run',
      warningMessage: 'deployment worker log append failed; continuing deployment'
    });
    await appendLogBestEffort(dependencies, {
      deploymentId: job.data.deploymentId,
      correlationId,
      message: `Deployment timeout is set to ${Math.floor(env.DEPLOYMENT_EXECUTION_TIMEOUT_MS / 1000)} seconds`,
      stage: 'pre-run',
      warningMessage: 'deployment worker log append failed; continuing deployment'
    });

    try {
      const result = await withTimeout(
        dependencies.runtimeExecutor.run(job.data),
        env.DEPLOYMENT_EXECUTION_TIMEOUT_MS
      );
      runtimeResult = result;

      if (await dependencies.stateService.isCancellationRequested(job.data.deploymentId)) {
        await dependencies.runtimeExecutor.cleanupCancelledRun({
          deploymentId: job.data.deploymentId,
          containerId: result.containerId,
          imageTag: result.imageTag
        });
        try {
          await dependencies.stateService.markStopped(
            job.data.deploymentId,
            `Deployment cancelled during build execution (correlation ${correlationId}).`
          );
        } catch (error) {
          await markFailedBestEffort(dependencies, {
            deploymentId: job.data.deploymentId,
            correlationId,
            prefix: 'DEPLOYMENT_CANCEL_FINALIZATION_FAILED',
            error,
            reason: 'cancelled-during-execution-finalization'
          });
          throw new CancellationFinalizationError(error);
        }
        dependencies.logger.info('deployment cancelled during execution', {
          deploymentId: job.data.deploymentId,
          correlationId,
          attempt: job.attemptsMade + 1
        });
        return;
      }

      await configureRouteIfNeeded(dependencies, {
        job,
        result,
        correlationId
      });

      await dependencies.stateService.markRunning({
        deploymentId: job.data.deploymentId,
        projectId: job.data.projectId,
        projectSlug: job.data.projectSlug,
        containerId: result.containerId,
        imageTag: result.imageTag,
        hostPort: result.hostPort,
        internalPort: result.internalPort,
        runtimeUrl: result.runtimeUrl
      });

      await appendLogBestEffort(dependencies, {
        deploymentId: job.data.deploymentId,
        correlationId,
        message: `Deployment running. Container ${result.containerName} on port ${result.hostPort ?? 'unknown'}`,
        stage: 'running',
        warningMessage: 'deployment post-run log append failed; continuing deployment'
      });
      emitDeploymentEventBestEffort(dependencies, {
        deploymentId: job.data.deploymentId,
        correlationId,
        stage: 'running',
        event: {
          type: 'deployment.running',
          deploymentId: job.data.deploymentId,
          projectId: job.data.projectId,
          projectSlug: job.data.projectSlug,
          correlationId,
          timestamp: new Date().toISOString(),
          details: { containerId: result.containerId, hostPort: result.hostPort }
        }
      });

      dependencies.logger.info('deployment finished', {
        deploymentId: job.data.deploymentId,
        correlationId,
        containerId: result.containerId,
        hostPort: result.hostPort,
        attempt: job.attemptsMade + 1
      });
    } catch (error) {
      if (error instanceof CancellationFinalizationError) {
        throw error.originalError;
      }

      const cancellationRequested = await dependencies.stateService.isCancellationRequested(job.data.deploymentId);

      if (runtimeResult) {
        await cleanupStartedRuntimeBestEffort(dependencies, {
          deploymentId: job.data.deploymentId,
          correlationId,
          result: runtimeResult,
          reason: cancellationRequested ? 'cancellation-after-post-run-failure' : 'post-run-failure'
        });
      }

      if (cancellationRequested) {
        try {
          await dependencies.stateService.markStopped(
            job.data.deploymentId,
            `Deployment cancellation confirmed after execution error (correlation ${correlationId}).`
          );
        } catch (markStoppedError) {
          await markFailedBestEffort(dependencies, {
            deploymentId: job.data.deploymentId,
            correlationId,
            prefix: 'DEPLOYMENT_CANCEL_FINALIZATION_FAILED',
            error: markStoppedError,
            reason: 'cancellation-after-error-finalization'
          });
          throw markStoppedError;
        }
        dependencies.logger.info('deployment cancellation finalized after execution error', {
          deploymentId: job.data.deploymentId,
          correlationId,
          attempt: job.attemptsMade + 1
        });
        return;
      }

      const failure = classifyDeploymentFailure(error);
      const retriesRemaining = remainingAttempts(job);

      if (!failure.retryable) {
        await dependencies.stateService.markFailed(job.data.deploymentId, `[${failure.code}] ${failure.message}`);
        emitDeploymentEventBestEffort(dependencies, {
          deploymentId: job.data.deploymentId,
          correlationId,
          stage: 'failed',
          event: {
            type: 'deployment.failed',
            deploymentId: job.data.deploymentId,
            projectId: job.data.projectId,
            projectSlug: job.data.projectSlug,
            correlationId,
            timestamp: new Date().toISOString(),
            details: { code: failure.code, message: failure.message }
          }
        });
        dependencies.logger.error('deployment failed (non-retryable)', {
          deploymentId: job.data.deploymentId,
          correlationId,
          code: failure.code,
          message: failure.message,
          attempt: job.attemptsMade + 1
        });
        throw new UnrecoverableError(failure.message);
      }

      if (retriesRemaining > 0) {
        await appendLogBestEffort(dependencies, {
          deploymentId: job.data.deploymentId,
          correlationId,
          message: `Attempt ${job.attemptsMade + 1} failed. Retrying (${retriesRemaining} retries left). Error: [${failure.code}] ${failure.message}`,
          level: 'warn',
          stage: 'retry-scheduled',
          warningMessage: 'deployment worker log append failed; continuing deployment'
        });

        dependencies.logger.warn('deployment attempt failed; retry scheduled', {
          deploymentId: job.data.deploymentId,
          correlationId,
          code: failure.code,
          message: failure.message,
          attempt: job.attemptsMade + 1,
          retriesRemaining
        });
        throw error;
      }

      await dependencies.stateService.markFailed(job.data.deploymentId, `[${failure.code}] ${failure.message}`);
      emitDeploymentEventBestEffort(dependencies, {
        deploymentId: job.data.deploymentId,
        correlationId,
        stage: 'failed',
        event: {
          type: 'deployment.failed',
          deploymentId: job.data.deploymentId,
          projectId: job.data.projectId,
          projectSlug: job.data.projectSlug,
          correlationId,
          timestamp: new Date().toISOString(),
          details: { code: failure.code, message: failure.message, retriesExhausted: true }
        }
      });
      dependencies.logger.error('deployment failed (retries exhausted)', {
        deploymentId: job.data.deploymentId,
        correlationId,
        code: failure.code,
        message: failure.message,
        attempt: job.attemptsMade + 1
      });
      throw error;
    }
  };
}

async function configureRouteIfNeeded(
  dependencies: Required<DeploymentJobProcessorDependencies>,
  input: {
    job: DeploymentJobLike;
    result: RuntimeExecutionResult;
    correlationId: string;
  }
) {
  if (input.result.hostPort === null) {
    return;
  }

  const host = `${input.job.data.projectSlug}.${env.PLATFORM_DOMAIN}`;
  try {
    await dependencies.caddyService.upsertRoute({ host, upstreamPort: input.result.hostPort });
    await appendLogBestEffort(dependencies, {
      deploymentId: input.job.data.deploymentId,
      correlationId: input.correlationId,
      message: `Route configured for ${host}`,
      stage: 'route-configured',
      warningMessage: 'deployment post-run log append failed; continuing deployment'
    });
  } catch (error) {
    const message = getErrorMessage(error);
    dependencies.logger.warn('failed to configure caddy route; continuing deployment', {
      deploymentId: input.job.data.deploymentId,
      correlationId: input.correlationId,
      host,
      upstreamPort: input.result.hostPort,
      message
    });
    await appendLogBestEffort(dependencies, {
      deploymentId: input.job.data.deploymentId,
      correlationId: input.correlationId,
      message: `Route configuration skipped (${message}). Container remains available on mapped port ${input.result.hostPort}.`,
      level: 'warn',
      stage: 'route-config-skipped',
      warningMessage: 'deployment post-run log append failed; continuing deployment'
    });
  }
}
