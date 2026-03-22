import type { ContainerRuntimeManager } from './container-runtime-manager.js';
import { createDockerContainerRuntimeManager } from './docker-container-runtime-manager.factory.js';
import { resolveRuntimeFamily } from './runtime-family-resolver.js';

export function createContainerRuntimeManager(): ContainerRuntimeManager {
  const runtimeFamily = resolveRuntimeFamily();

  if (runtimeFamily === 'docker') {
    return createDockerContainerRuntimeManager();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${runtimeFamily}`);
}
