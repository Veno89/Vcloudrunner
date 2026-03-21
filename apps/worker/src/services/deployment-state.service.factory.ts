import { DeploymentStateService } from './deployment-state.service.js';

export function createDeploymentStateService() {
  return new DeploymentStateService();
}
