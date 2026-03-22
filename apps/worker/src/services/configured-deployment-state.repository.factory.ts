import { createDeploymentStateQueryable } from './deployment-state-queryable.factory.js';
import { DeploymentStateRepository } from './deployment-state.repository.js';

export function createConfiguredDeploymentStateRepository() {
  return new DeploymentStateRepository(createDeploymentStateQueryable());
}
