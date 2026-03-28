import { UnrecoverableError } from 'bullmq';
import {
  isPublicWebServiceTarget,
  type DeploymentJobPayload
} from '@vcloudrunner/shared-types';

import { env } from '../config/env.js';
import type { DeploymentEventSink } from '../services/deployment-event-sink.js';
import type { DeploymentEvent } from '../services/deployment-events.js';
import type { IngressManager } from '../services/ingress/ingress-manager.js';
import type { RuntimeExecutionResult, RuntimeExecutor } from '../services/runtime/runtime-executor.js';
import { createDeploymentJobProcessorDependencies } from './deployment-job-processor-dependencies.factory.js';
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

export interface StateServiceLike {
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
    routeHosts?: string[];
  }): Promise<void>;
  markFailed(deploymentId: string, message: string): Promise<void>;
}

export interface LoggerLike {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface DeploymentJobProcessorDependencies {
  runtimeExecutor?: RuntimeExecutor;
  stateService?: StateServiceLike;
  ingressManager?: IngressManager;
  logger?: LoggerLike;
  eventSink?: DeploymentEventSink;
}

class CancellationFinalizationError extends Error {
  constructor(public readonly originalError: unknown) {
    super(getErrorMessage(originalError));
    this.name = 'CancellationFinalizationError';
  }
}

class CancellationCleanupError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly phase: 'during-execution' | 'after-execution-error'
  ) {
    super(getErrorMessage(originalError));
    this.name = 'CancellationCleanupError';
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

function describeDeploymentService(job: DeploymentJobPayload) {
  const serviceName = job.serviceName ?? 'app';
  const serviceKind = job.serviceKind ?? 'web';
  const serviceExposure = job.serviceExposure ?? 'public';

  return `service ${serviceName} (${serviceKind}/${serviceExposure})`;
}

function createDefaultProjectRouteHost(projectSlug: string) {
  return `${projectSlug}.${env.PLATFORM_DOMAIN}`;
}

function getDesiredPublicRouteHosts(job: DeploymentJobPayload) {
  const defaultHost = createDefaultProjectRouteHost(job.projectSlug);
  const additionalHosts = Array.isArray(job.publicRouteHosts)
    ? job.publicRouteHosts
      .filter((host): host is string => typeof host === 'string')
      .map((host) => host.trim())
      .filter((host) => host.length > 0 && host !== defaultHost)
    : [];

  return [defaultHost, ...additionalHosts];
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
    event: DeploymentEvent;
    stage:
      | 'cancelled-before-execution'
      | 'cancelled-during-execution'
      | 'cancelled-after-error'
      | 'building'
      | 'running'
      | 'failed';
  }
) {
  try {
    dependencies.eventSink.emit(input.event);
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
    return { ok: true as const };
  } catch (error) {
    dependencies.logger.warn('deployment runtime cleanup failed after post-run error', {
      deploymentId: input.deploymentId,
      correlationId: input.correlationId,
      reason: input.reason,
      message: getErrorMessage(error)
    });
    return {
      ok: false as const,
      error
    };
  }
}

async function cleanupRoutesBestEffort(
  dependencies: Required<DeploymentJobProcessorDependencies>,
  input: {
    deploymentId: string;
    correlationId: string;
    hosts: string[];
    reason: 'post-run-failure' | 'cancellation-after-post-run-failure';
  }
) {
  for (const host of [...new Set(input.hosts)]) {
    try {
      await dependencies.ingressManager.deleteRoute({ host });
    } catch (error) {
      dependencies.logger.warn('deployment route cleanup failed after post-run error', {
        deploymentId: input.deploymentId,
        correlationId: input.correlationId,
        host,
        reason: input.reason,
        message: getErrorMessage(error)
      });
    }
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
    ...createDeploymentJobProcessorDependencies(),
    ...overrides
  };

  return async (job: DeploymentJobLike) => {
    const correlationId = job.data.correlationId ?? `queue-job:${job.id ?? 'unknown'}`;
    let runtimeResult: RuntimeExecutionResult | null = null;
    let configuredRouteHosts: string[] = [];

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
        try {
          await dependencies.runtimeExecutor.cleanupCancelledRun({
            deploymentId: job.data.deploymentId,
            containerId: result.containerId,
            imageTag: result.imageTag
          });
        } catch (cleanupError) {
          throw new CancellationCleanupError(cleanupError, 'during-execution');
        }
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
        emitDeploymentEventBestEffort(dependencies, {
          deploymentId: job.data.deploymentId,
          correlationId,
          stage: 'cancelled-during-execution',
          event: {
            type: 'deployment.cancelled',
            deploymentId: job.data.deploymentId,
            projectId: job.data.projectId,
            projectSlug: job.data.projectSlug,
            correlationId,
            timestamp: new Date().toISOString(),
            details: { containerId: result.containerId }
          }
        });
        return;
      }

      const routeConfig = await configureRoutesIfNeeded(dependencies, {
        job,
        result,
        correlationId
      });
      configuredRouteHosts = routeConfig.configuredHosts;

      await dependencies.stateService.markRunning({
        deploymentId: job.data.deploymentId,
        projectId: job.data.projectId,
        projectSlug: job.data.projectSlug,
        containerId: result.containerId,
        imageTag: result.imageTag,
        hostPort: result.hostPort,
        internalPort: result.internalPort,
        runtimeUrl: routeConfig.runtimeUrl,
        routeHosts: routeConfig.persistedHosts
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
      const cancellationCleanupPhase =
        error instanceof CancellationCleanupError ? error.phase : 'after-execution-error';
      let cleanupFailure: unknown = null;

      if (runtimeResult) {
        const cleanupResult = await cleanupStartedRuntimeBestEffort(dependencies, {
          deploymentId: job.data.deploymentId,
          correlationId,
          result: runtimeResult,
          reason: cancellationRequested ? 'cancellation-after-post-run-failure' : 'post-run-failure'
        });

        if (!cleanupResult.ok) {
          cleanupFailure = cleanupResult.error;
        }

        if (configuredRouteHosts.length > 0) {
          await cleanupRoutesBestEffort(dependencies, {
            deploymentId: job.data.deploymentId,
            correlationId,
            hosts: configuredRouteHosts,
            reason: cancellationRequested ? 'cancellation-after-post-run-failure' : 'post-run-failure'
          });
        }
      }

      if (cancellationRequested) {
        if (cleanupFailure) {
          await markFailedBestEffort(dependencies, {
            deploymentId: job.data.deploymentId,
            correlationId,
            prefix: 'DEPLOYMENT_CANCEL_RUNTIME_CLEANUP_FAILED',
            error: cleanupFailure,
            reason:
              cancellationCleanupPhase === 'during-execution'
                ? 'cancelled-during-execution-finalization'
                : 'cancellation-after-error-finalization'
          });
          throw cleanupFailure;
        }

        const stopMessage =
          cancellationCleanupPhase === 'during-execution'
            ? `Deployment cancelled during build execution (correlation ${correlationId}).`
            : `Deployment cancellation confirmed after execution error (correlation ${correlationId}).`;
        try {
          await dependencies.stateService.markStopped(job.data.deploymentId, stopMessage);
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
        dependencies.logger.info(
          cancellationCleanupPhase === 'during-execution'
            ? 'deployment cancelled during execution'
            : 'deployment cancellation finalized after execution error',
          {
            deploymentId: job.data.deploymentId,
            correlationId,
            attempt: job.attemptsMade + 1
          }
        );
        emitDeploymentEventBestEffort(dependencies, {
          deploymentId: job.data.deploymentId,
          correlationId,
          stage:
            cancellationCleanupPhase === 'during-execution'
              ? 'cancelled-during-execution'
              : 'cancelled-after-error',
          event: {
            type: 'deployment.cancelled',
            deploymentId: job.data.deploymentId,
            projectId: job.data.projectId,
            projectSlug: job.data.projectSlug,
            correlationId,
            timestamp: new Date().toISOString(),
            ...(cancellationCleanupPhase === 'during-execution' && runtimeResult
              ? {
                  details: {
                    containerId: runtimeResult.containerId
                  }
                }
              : {})
          }
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

async function configureRoutesIfNeeded(
  dependencies: Required<DeploymentJobProcessorDependencies>,
  input: {
    job: DeploymentJobLike;
    result: RuntimeExecutionResult;
    correlationId: string;
  }
) {
  if (!isPublicWebServiceTarget({
    kind: input.job.data.serviceKind,
    exposure: input.job.data.serviceExposure
  })) {
    await appendLogBestEffort(dependencies, {
      deploymentId: input.job.data.deploymentId,
      correlationId: input.correlationId,
      message: `Public route skipped for ${describeDeploymentService(input.job.data)} because it is not a public web service.`,
      stage: 'route-config-skipped',
      warningMessage: 'deployment post-run log append failed; continuing deployment'
    });
    return {
      configuredHosts: [],
      persistedHosts: [],
      runtimeUrl: null
    };
  }

  if (input.result.hostPort === null) {
    return {
      configuredHosts: [],
      persistedHosts: [],
      runtimeUrl: null
    };
  }

  const desiredHosts = getDesiredPublicRouteHosts(input.job.data);
  const configuredHosts: string[] = [];

  for (const host of desiredHosts) {
    try {
      await dependencies.ingressManager.upsertRoute({ host, upstreamPort: input.result.hostPort });
      configuredHosts.push(host);
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
        message: `Route configuration skipped for ${host} (${message}). Container remains available on mapped port ${input.result.hostPort}.`,
        level: 'warn',
        stage: 'route-config-skipped',
        warningMessage: 'deployment post-run log append failed; continuing deployment'
      });
    }
  }

  if (configuredHosts.length > 0) {
    await appendLogBestEffort(dependencies, {
      deploymentId: input.job.data.deploymentId,
      correlationId: input.correlationId,
      message:
        configuredHosts.length === 1
          ? `Route configured for ${configuredHosts[0]}`
          : `Routes configured for ${configuredHosts.join(', ')}`,
      stage: 'route-configured',
      warningMessage: 'deployment post-run log append failed; continuing deployment'
    });
  }

  const defaultHost = desiredHosts[0] ?? null;
  const persistedHosts = defaultHost
    ? [defaultHost, ...configuredHosts.filter((host) => host !== defaultHost)]
    : [];
  const preferredHost = defaultHost && configuredHosts.includes(defaultHost)
    ? defaultHost
    : configuredHosts[0] ?? null;

  return {
    configuredHosts,
    persistedHosts,
    runtimeUrl: preferredHost ? `http://${preferredHost}` : null
  };
}
