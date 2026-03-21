import type { DeploymentWorkspaceManager } from './deployment-workspace-manager.js';
import { LocalDeploymentWorkspaceManager } from './local-deployment-workspace-manager.js';

export function createDeploymentWorkspaceManager(): DeploymentWorkspaceManager {
  return new LocalDeploymentWorkspaceManager();
}
