import { createContainerRuntimeManager } from './runtime/container-runtime-manager.factory.js';
import { createConfiguredDeploymentImageBuilder } from './runtime/configured-deployment-image-builder.factory.js';
import { createDeploymentWorkspaceManager } from './runtime/deployment-workspace-manager.factory.js';
import { DeploymentRunner } from './deployment-runner.js';

export function createConfiguredDeploymentRunner() {
  return new DeploymentRunner(
    createDeploymentWorkspaceManager(),
    createConfiguredDeploymentImageBuilder(),
    createContainerRuntimeManager()
  );
}
