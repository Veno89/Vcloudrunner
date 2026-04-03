import type { Job } from 'bullmq';
import type { DeploymentStopJobPayload } from '@vcloudrunner/shared-types';

import { logger as defaultLogger } from '../logger/logger.js';
import { createContainerRuntimeManager } from '../services/runtime/container-runtime-manager.factory.js';
import { createConfiguredIngressManager } from '../services/ingress/configured-ingress-manager.factory.js';
import type { ContainerRuntimeManager } from '../services/runtime/container-runtime-manager.js';
import type { IngressManager } from '../services/ingress/ingress-manager.js';

export interface StopJobProcessorDependencies {
  runtimeManager: ContainerRuntimeManager;
  ingressManager: IngressManager;
  logger: {
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, metadata?: Record<string, unknown>): void;
  };
}

export function createStopJobProcessor(deps?: Partial<StopJobProcessorDependencies>) {
  const runtimeManager = deps?.runtimeManager ?? createContainerRuntimeManager();
  const ingressManager = deps?.ingressManager ?? createConfiguredIngressManager();
  const logger = deps?.logger ?? defaultLogger;

  return async function processStopJob(job: Job<DeploymentStopJobPayload>) {
    const { deploymentId, containerId, routeHosts } = job.data;

    logger.info('stopping deployment', { deploymentId, containerId });

    try {
      await runtimeManager.stopContainer(containerId);
      logger.info('container stopped', { deploymentId, containerId });
    } catch (error) {
      logger.warn('container stop failed (may already be stopped)', {
        deploymentId,
        containerId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await runtimeManager.removeContainer(containerId);
      logger.info('container removed', { deploymentId, containerId });
    } catch (error) {
      logger.warn('container removal failed (may already be removed)', {
        deploymentId,
        containerId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    for (const host of routeHosts) {
      try {
        await ingressManager.deleteRoute({ host });
        logger.info('route deleted', { deploymentId, host });
      } catch (error) {
        logger.warn('route deletion failed', {
          deploymentId,
          host,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('deployment stopped successfully', { deploymentId });
  };
}
