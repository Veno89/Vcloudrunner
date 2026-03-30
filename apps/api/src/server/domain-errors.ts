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

export class ProjectDomainAlreadyExistsError extends DomainError {
  constructor() {
    super('PROJECT_DOMAIN_ALREADY_EXISTS', 'Project domain is already in use', 409);
  }
}

export class ProjectDomainNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_DOMAIN_NOT_FOUND', 'Project domain not found', 404);
  }
}

export class ProjectDomainReservedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DOMAIN_RESERVED',
      'Platform-managed default hosts cannot be claimed manually',
      409
    );
  }
}

export class ProjectDomainRemovalNotAllowedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DOMAIN_REMOVAL_NOT_ALLOWED',
      'Project domains attached to queued or building deployments cannot be removed until that deployment finishes or is cancelled',
      409
    );
  }
}

export class ProjectDomainDeactivationFailedError extends DomainError {
  constructor(host: string) {
    super(
      'PROJECT_DOMAIN_DEACTIVATION_FAILED',
      `The live route for ${host} could not be detached right now`,
      503
    );
  }
}

export class ProjectDatabaseAlreadyExistsError extends DomainError {
  constructor() {
    super('PROJECT_DATABASE_ALREADY_EXISTS', 'Project database name is already in use', 409);
  }
}

export class ProjectDatabaseNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_DATABASE_NOT_FOUND', 'Project database not found', 404);
  }
}

export class ProjectDatabaseProvisioningUnavailableError extends DomainError {
  constructor(message = 'Managed Postgres provisioning is not configured yet') {
    super('PROJECT_DATABASE_PROVISIONING_UNAVAILABLE', message, 503);
  }
}

export class ProjectDatabaseDeprovisioningFailedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DATABASE_DEPROVISIONING_FAILED',
      'The managed Postgres resource could not be removed right now',
      503
    );
  }
}

export class ProjectDatabaseCredentialRotationNotAllowedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DATABASE_CREDENTIAL_ROTATION_NOT_ALLOWED',
      'Managed Postgres credentials can only be rotated after the database is provisioned and has runtime connection details',
      409
    );
  }
}

export class ProjectDatabaseCredentialRotationFailedError extends DomainError {
  constructor(message = 'Managed Postgres credentials could not be rotated right now') {
    super(
      'PROJECT_DATABASE_CREDENTIAL_ROTATION_FAILED',
      message,
      503
    );
  }
}

export class ProjectDatabaseRecoveryCheckNotAllowedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DATABASE_RECOVERY_CHECK_NOT_ALLOWED',
      'Recovery checks can only be recorded after an external backup plan has been documented for this managed database',
      409
    );
  }
}

export class ProjectDatabaseBackupArtifactNotAllowedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DATABASE_BACKUP_ARTIFACT_NOT_ALLOWED',
      'Backup artifacts can only be recorded after an external backup plan has been documented for this managed database',
      409
    );
  }
}

export class ProjectDatabaseBackupArtifactNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_DATABASE_BACKUP_ARTIFACT_NOT_FOUND', 'Project database backup artifact not found', 404);
  }
}

export class ProjectDatabaseBackupArtifactUnavailableError extends DomainError {
  constructor() {
    super(
      'PROJECT_DATABASE_BACKUP_ARTIFACT_UNAVAILABLE',
      'That backup artifact is no longer marked as restorable for this managed database',
      409
    );
  }
}

export class ProjectDatabaseRestoreRequestNotAllowedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DATABASE_RESTORE_REQUEST_NOT_ALLOWED',
      'Restore requests can only be created after an external backup plan has been documented for this managed database',
      409
    );
  }
}

export class ProjectDatabaseRestoreRequestNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_DATABASE_RESTORE_REQUEST_NOT_FOUND', 'Project database restore request not found', 404);
  }
}

export class ProjectDatabaseRestoreRequestApprovalNotAllowedError extends DomainError {
  constructor() {
    super(
      'PROJECT_DATABASE_RESTORE_REQUEST_APPROVAL_NOT_ALLOWED',
      'That restore request must be approved before execution state can be advanced',
      409
    );
  }
}

export class UserEmailTakenError extends DomainError {
  constructor() {
    super('USER_EMAIL_TAKEN', 'Email is already in use by another user', 409);
  }
}

export class ProjectMemberAlreadyExistsError extends DomainError {
  constructor() {
    super('PROJECT_MEMBER_ALREADY_EXISTS', 'User is already a project member', 409);
  }
}

export class ProjectInvitationAlreadyExistsError extends DomainError {
  constructor() {
    super('PROJECT_INVITATION_ALREADY_EXISTS', 'Project invitation already exists for that email', 409);
  }
}

export class ProjectInvitationNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_INVITATION_NOT_FOUND', 'Project invitation not found', 404);
  }
}

export class ProjectInvitationNotPendingError extends DomainError {
  constructor() {
    super('PROJECT_INVITATION_NOT_PENDING', 'Project invitation is no longer pending', 409);
  }
}

export class ProjectInvitationEmailMismatchError extends DomainError {
  constructor() {
    super(
      'PROJECT_INVITATION_EMAIL_MISMATCH',
      'Project invitation was sent to a different email address',
      403
    );
  }
}

export class UserProfileRequiredError extends DomainError {
  constructor() {
    super(
      'USER_PROFILE_REQUIRED',
      'Complete account setup before claiming this project invitation',
      409
    );
  }
}

export class ProjectMemberUserNotFoundError extends DomainError {
  constructor() {
    super(
      'PROJECT_MEMBER_USER_NOT_FOUND',
      'No persisted user was found for the provided email address',
      404
    );
  }
}

export class ProjectMemberNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_MEMBER_NOT_FOUND', 'Project member not found', 404);
  }
}

export class ProjectOwnerMembershipImmutableError extends DomainError {
  constructor() {
    super(
      'PROJECT_OWNER_MEMBERSHIP_IMMUTABLE',
      'Project owner membership cannot be changed or removed',
      409
    );
  }
}

export class ForbiddenProjectOwnershipTransferError extends DomainError {
  constructor() {
    super(
      'FORBIDDEN_PROJECT_OWNERSHIP_TRANSFER',
      'Only the current project owner or a platform admin can transfer project ownership',
      403
    );
  }
}

export class ForbiddenProjectDeletionError extends DomainError {
  constructor() {
    super(
      'FORBIDDEN_PROJECT_DELETION',
      'Only the current project owner or a platform admin can delete a project',
      403
    );
  }
}

export class ProjectDeletionNotAllowedError extends DomainError {
  constructor(serviceNames: string[] = []) {
    const uniqueServiceNames = Array.from(new Set(
      serviceNames.map((serviceName) => serviceName.trim()).filter((serviceName) => serviceName.length > 0)
    ));
    super(
      'PROJECT_DELETION_NOT_ALLOWED',
      uniqueServiceNames.length > 0
        ? `Project cannot be deleted while active deployments exist for ${uniqueServiceNames.join(', ')}`
        : 'Project cannot be deleted while active deployments exist',
      409
    );
  }
}

export class ForbiddenProjectMembershipManagementError extends DomainError {
  constructor() {
    super(
      'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT',
      'Project membership management requires owner, admin, or project-admin access',
      403
    );
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
