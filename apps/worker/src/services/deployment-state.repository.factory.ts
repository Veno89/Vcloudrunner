import { DeploymentStateRepository, type Queryable } from './deployment-state.repository.js';

export function createDeploymentStateRepository(pool?: Queryable) {
  return new DeploymentStateRepository(pool);
}
