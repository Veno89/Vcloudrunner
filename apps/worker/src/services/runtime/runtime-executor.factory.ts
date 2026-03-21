import { DockerRuntimeExecutor } from './docker-runtime-executor.js';
import type { RuntimeExecutor } from './runtime-executor.js';
import { resolveRuntimeFamily } from './runtime-family-resolver.js';

export function createRuntimeExecutor(): RuntimeExecutor {
  const runtimeFamily = resolveRuntimeFamily();

  if (runtimeFamily === 'docker') {
    return new DockerRuntimeExecutor();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${runtimeFamily}`);
}
