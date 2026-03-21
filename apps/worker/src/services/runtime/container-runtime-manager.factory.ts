import { env } from '../../config/env.js';
import type { ContainerRuntimeManager } from './container-runtime-manager.js';
import { DockerContainerRuntimeManager } from './docker-container-runtime-manager.js';

export function createContainerRuntimeManager(): ContainerRuntimeManager {
  if (env.DEPLOYMENT_RUNTIME_EXECUTOR === 'docker') {
    return new DockerContainerRuntimeManager();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${env.DEPLOYMENT_RUNTIME_EXECUTOR}`);
}
