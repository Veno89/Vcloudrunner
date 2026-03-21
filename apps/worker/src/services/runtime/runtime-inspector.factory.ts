import { env } from '../../config/env.js';
import { DockerRuntimeInspector } from './docker-runtime-inspector.js';
import type { RuntimeInspector } from './runtime-inspector.js';

export function createRuntimeInspector(): RuntimeInspector {
  if (env.DEPLOYMENT_RUNTIME_EXECUTOR === 'docker') {
    return new DockerRuntimeInspector();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${env.DEPLOYMENT_RUNTIME_EXECUTOR}`);
}
