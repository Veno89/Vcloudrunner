import { logger } from '../logger/logger.js';
import { createDeploymentEventSink } from '../services/deployment-event-sink.factory.js';
import { createDeploymentStateService } from '../services/deployment-state.service.factory.js';
import { createIngressManager } from '../services/ingress/ingress-manager.factory.js';
import { createRuntimeExecutor } from '../services/runtime/runtime-executor.factory.js';
import type { DeploymentJobProcessorDependencies } from './deployment-job-processor.js';

interface CreateDeploymentJobProcessorDependenciesOptions {
  createRuntimeExecutor?: typeof createRuntimeExecutor;
  createStateService?: typeof createDeploymentStateService;
  createIngressManager?: typeof createIngressManager;
  createEventSink?: typeof createDeploymentEventSink;
  logger?: DeploymentJobProcessorDependencies['logger'];
}

export function createDeploymentJobProcessorDependencies(
  options: CreateDeploymentJobProcessorDependenciesOptions = {}
): Required<DeploymentJobProcessorDependencies> {
  const createRuntimeExecutorFn = options.createRuntimeExecutor ?? createRuntimeExecutor;
  const createStateServiceFn = options.createStateService ?? createDeploymentStateService;
  const createIngressManagerFn = options.createIngressManager ?? createIngressManager;
  const createEventSinkFn = options.createEventSink ?? createDeploymentEventSink;

  return {
    runtimeExecutor: createRuntimeExecutorFn(),
    stateService: createStateServiceFn(),
    ingressManager: createIngressManagerFn(),
    logger: options.logger ?? logger,
    eventSink: createEventSinkFn()
  };
}
