import { env } from '../../config/env.js';
import { DockerRuntimeExecutor } from './docker-runtime-executor.js';
import type { RuntimeExecutor } from './runtime-executor.js';

export function createRuntimeExecutor(): RuntimeExecutor {
  if (env.DEPLOYMENT_RUNTIME_EXECUTOR === 'docker') {
    return new DockerRuntimeExecutor();
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${env.DEPLOYMENT_RUNTIME_EXECUTOR}`);
}