import { createDockerRuntimeExecutor } from './docker-runtime-executor.factory.js';
import type { RuntimeExecutor } from './runtime-executor.js';
import { resolveRuntimeFamily } from './runtime-family-resolver.js';

export function createRuntimeExecutor(): RuntimeExecutor {
  const runtimeFamily = resolveRuntimeFamily();

  if (runtimeFamily === 'docker') {
    return createDockerRuntimeExecutor();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${runtimeFamily}`);
}
