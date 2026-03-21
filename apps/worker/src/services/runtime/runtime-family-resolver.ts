import { env } from '../../config/env.js';

export type RuntimeFamily = 'docker';

export function resolveRuntimeFamily(
  configuredRuntimeFamily: string = env.DEPLOYMENT_RUNTIME_EXECUTOR
): RuntimeFamily {
  if (configuredRuntimeFamily === 'docker') {
    return configuredRuntimeFamily;
  }

  throw new Error(`Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: ${configuredRuntimeFamily}`);
}
