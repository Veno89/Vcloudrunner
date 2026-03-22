import { createDockerRuntimeInspector } from './docker-runtime-inspector.factory.js';
import type { RuntimeInspector } from './runtime-inspector.js';
import { resolveRuntimeFamily } from './runtime-family-resolver.js';

export function createRuntimeInspector(): RuntimeInspector {
  const runtimeFamily = resolveRuntimeFamily();

  if (runtimeFamily === 'docker') {
    return createDockerRuntimeInspector();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${runtimeFamily}`);
}
