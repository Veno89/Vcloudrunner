export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends DomainError {
  constructor() {
    super('UNAUTHORIZED', 'Missing or invalid Bearer token', 401);
  }
}

export class ForbiddenUserAccessError extends DomainError {
  constructor() {
    super('FORBIDDEN_USER_ACCESS', 'Cannot access another user resource', 403);
  }
}

export class ForbiddenProjectAccessError extends DomainError {
  constructor() {
    super('FORBIDDEN_PROJECT_ACCESS', 'Project access denied', 403);
  }
}

export class ForbiddenTokenScopeError extends DomainError {
  constructor(scope: string) {
    super('FORBIDDEN_TOKEN_SCOPE', `Token is missing required scope: ${scope}`, 403);
  }
}

export class ProjectNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_NOT_FOUND', 'Project not found', 404);
  }
}

export class InvalidProjectServiceError extends DomainError {
  constructor(serviceName: string) {
    super(
      'INVALID_PROJECT_SERVICE',
      `Requested project service "${serviceName}" does not exist`,
      400
    );
  }
}

export class DeploymentNotFoundError extends DomainError {
  constructor() {
    super('DEPLOYMENT_NOT_FOUND', 'Deployment not found', 404);
  }
}

export class DeploymentCancellationNotAllowedError extends DomainError {
  constructor(status: string) {
    super(
      'DEPLOYMENT_CANCELLATION_NOT_ALLOWED',
      `Deployment cannot be cancelled while status is ${status}`,
      409
    );
  }
}

export class DeploymentAlreadyActiveError extends DomainError {
  constructor(serviceName?: string) {
    super(
      'DEPLOYMENT_ALREADY_ACTIVE',
      serviceName
        ? `Project service "${serviceName}" already has an active deployment (queued, building, or running)`
        : 'Project already has an active deployment (queued, building, or running)',
      409
    );
  }
}


export class DeploymentQueueUnavailableError extends DomainError {
  constructor() {
    super(
      'DEPLOYMENT_QUEUE_UNAVAILABLE',
      'Deployment could not be queued; please retry shortly',
      503
    );
  }
}

export class ProjectSlugTakenError extends DomainError {
  constructor() {
    super('PROJECT_SLUG_TAKEN', 'Project slug is already in use', 409);
  }
}

export class EnvironmentVariableNotFoundError extends DomainError {
  constructor() {
    super('ENV_NOT_FOUND', 'Environment variable not found', 404);
  }
}

export class ApiTokenNotFoundError extends DomainError {
  constructor() {
    super('API_TOKEN_NOT_FOUND', 'API token not found or already revoked', 404);
  }
}
