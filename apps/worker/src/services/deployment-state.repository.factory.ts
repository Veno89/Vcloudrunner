import { createConfiguredDeploymentStateRepository } from './configured-deployment-state.repository.factory.js';
import { DeploymentStateRepository, type Queryable } from './deployment-state.repository.js';

export function createDeploymentStateRepository(pool?: Queryable) {
  if (pool) {
    return new DeploymentStateRepository(pool);
  }

  return createConfiguredDeploymentStateRepository();
}
