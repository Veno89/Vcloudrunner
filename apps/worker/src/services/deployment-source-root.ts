import { join } from 'node:path';

import { DeploymentFailure } from '../workers/deployment-errors.js';

export const ROOT_DEPLOYMENT_SOURCE_ROOT = '.';

function getInvalidSourceRootError(sourceRoot: string) {
  return new DeploymentFailure(
    'DEPLOYMENT_CONFIGURATION_ERROR',
    `DEPLOYMENT_CONFIGURATION_ERROR: invalid service source root "${sourceRoot}"`,
    false
  );
}

export function normalizeDeploymentSourceRoot(sourceRoot?: string | null): string {
  const trimmedSourceRoot = sourceRoot?.trim();

  if (!trimmedSourceRoot || trimmedSourceRoot === ROOT_DEPLOYMENT_SOURCE_ROOT) {
    return ROOT_DEPLOYMENT_SOURCE_ROOT;
  }

  const slashNormalizedSourceRoot = trimmedSourceRoot.replace(/\\/g, '/').replace(/\/+/g, '/');
  const withoutDotPrefix = slashNormalizedSourceRoot.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '');

  if (!withoutDotPrefix) {
    return ROOT_DEPLOYMENT_SOURCE_ROOT;
  }

  if (withoutDotPrefix.startsWith('/') || /^[A-Za-z]:/.test(withoutDotPrefix)) {
    throw getInvalidSourceRootError(trimmedSourceRoot);
  }

  const segments = withoutDotPrefix.split('/');

  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw getInvalidSourceRootError(trimmedSourceRoot);
  }

  return segments.join('/');
}

export function resolveDeploymentProjectPath(repoDir: string, sourceRoot?: string | null): string {
  const normalizedSourceRoot = normalizeDeploymentSourceRoot(sourceRoot);

  return normalizedSourceRoot === ROOT_DEPLOYMENT_SOURCE_ROOT
    ? repoDir
    : join(repoDir, ...normalizedSourceRoot.split('/'));
}
