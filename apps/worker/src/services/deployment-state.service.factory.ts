import { createConfiguredDeploymentStateService } from './configured-deployment-state.service.factory.js';
import {
  createDeploymentStateServiceDependencies,
  type CreateDeploymentStateServiceDependenciesOptions
} from './deployment-state-service-dependencies.factory.js';
import { DeploymentStateService } from './deployment-state.service.js';

function hasDependencyOverrides(options: CreateDeploymentStateServiceDependenciesOptions) {
  return (
    options.pool !== undefined ||
    options.ingressManager !== undefined ||
    options.archiveUploader !== undefined ||
    options.archiveStore !== undefined ||
    options.archiveBuilder !== undefined
  );
}

export function createDeploymentStateService(
  options: CreateDeploymentStateServiceDependenciesOptions = {}
) {
  if (!hasDependencyOverrides(options)) {
    return createConfiguredDeploymentStateService();
  }

  return new DeploymentStateService(createDeploymentStateServiceDependencies(options));
}
