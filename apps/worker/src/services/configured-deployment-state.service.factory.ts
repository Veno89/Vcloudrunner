import { createDeploymentStateServiceDependencies } from './deployment-state-service-dependencies.factory.js';
import { DeploymentStateService } from './deployment-state.service.js';

export function createConfiguredDeploymentStateService() {
  return new DeploymentStateService(createDeploymentStateServiceDependencies());
}
