export type DeploymentFailureCode =
  | 'DEPLOYMENT_TIMEOUT'
  | 'DEPLOYMENT_DOCKERFILE_NOT_FOUND'
  | 'DEPLOYMENT_REPOSITORY_AUTH_FAILED'
  | 'DEPLOYMENT_REPOSITORY_NOT_FOUND'
  | 'DEPLOYMENT_CONFIGURATION_ERROR'
  | 'DEPLOYMENT_CANCELLED'
  | 'DEPLOYMENT_TRANSIENT_FAILURE';

export class DeploymentFailure extends Error {
  constructor(
    public readonly code: DeploymentFailureCode,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'DeploymentFailure';
  }
}

export function classifyDeploymentFailure(error: unknown): DeploymentFailure {
  if (error instanceof DeploymentFailure) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error ?? 'Unknown deployment failure');
  const normalized = message.toLowerCase();

  if (normalized.includes('deployment_timeout_exceeded')) {
    return new DeploymentFailure('DEPLOYMENT_TIMEOUT', message, false);
  }

  if (normalized.includes('deployment_cancelled')) {
    return new DeploymentFailure('DEPLOYMENT_CANCELLED', message, false);
  }

  if (normalized.includes('deployment_dockerfile_not_found')) {
    return new DeploymentFailure('DEPLOYMENT_DOCKERFILE_NOT_FOUND', message, false);
  }

  if (
    normalized.includes('authentication failed') ||
    normalized.includes('could not read username') ||
    normalized.includes('remote: permission denied')
  ) {
    return new DeploymentFailure('DEPLOYMENT_REPOSITORY_AUTH_FAILED', message, false);
  }

  if (normalized.includes('repository not found')) {
    return new DeploymentFailure('DEPLOYMENT_REPOSITORY_NOT_FOUND', message, false);
  }

  if (
    normalized.includes('project access denied') ||
    normalized.includes('missing or invalid x-user-id header')
  ) {
    return new DeploymentFailure('DEPLOYMENT_CONFIGURATION_ERROR', message, false);
  }

  return new DeploymentFailure('DEPLOYMENT_TRANSIENT_FAILURE', message, true);
}
