import type { ContainerRuntimeManager } from './container-runtime-manager.js';
import { DockerContainerRuntimeManager } from './docker-container-runtime-manager.js';
import { resolveRuntimeFamily } from './runtime-family-resolver.js';

export function createContainerRuntimeManager(): ContainerRuntimeManager {
  const runtimeFamily = resolveRuntimeFamily();

  if (runtimeFamily === 'docker') {
    return new DockerContainerRuntimeManager();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${runtimeFamily}`);
}
