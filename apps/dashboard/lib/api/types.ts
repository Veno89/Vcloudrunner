import type {
  DeploymentStatus,
  ProjectServiceDefinition,
  ProjectServiceExposure,
  ProjectServiceKind
} from '@vcloudrunner/shared-types';

export interface ApiProject {
  id: string;
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch: string;
  services: ProjectServiceDefinition[];
}

export interface ApiProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ApiProjectInvitation {
  id: string;
  projectId: string;
  email: string;
  claimToken: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'cancelled';
  invitedBy: string | null;
  acceptedBy: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  invitedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  acceptedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ApiProjectInvitationClaim extends ApiProjectInvitation {
  projectName: string;
  projectSlug: string;
}

export interface ApiProjectInvitationDelivery {
  status: 'disabled' | 'delivered' | 'failed';
  message: string;
  claimUrl: string;
  attemptedAt: string;
}

export type ApiProjectInviteResult =
  | {
      kind: 'member';
      member: ApiProjectMember;
    }
  | {
      kind: 'invitation';
      invitation: ApiProjectInvitation;
      delivery: ApiProjectInvitationDelivery;
    };

export interface ApiProjectInvitationRedeliveryResult {
  invitation: ApiProjectInvitation;
  delivery: ApiProjectInvitationDelivery;
}

export interface ApiProjectDomainEvent {
  id: string;
  projectId: string;
  domainId: string;
  kind:
    | 'ownership'
    | 'tls'
    | 'certificate'
    | 'certificate_trust'
    | 'certificate_path_validity'
    | 'certificate_identity'
    | 'certificate_attention'
    | 'certificate_chain';
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: string;
}

export interface ApiProjectDomain {
  id: string;
  projectId: string;
  deploymentId: string | null;
  host: string;
  targetPort: number;
  createdAt: string;
  updatedAt: string;
  deploymentStatus: DeploymentStatus | null;
  runtimeUrl: string | null;
  serviceName: string | null;
  serviceKind: ProjectServiceKind | null;
  serviceExposure: ProjectServiceExposure | null;
  routeStatus: 'active' | 'degraded' | 'stale' | 'pending';
  statusDetail: string;
  verificationStatus?: 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
  verificationDetail?: string;
  verificationCheckedAt?: string | null;
  verificationStatusChangedAt?: string | null;
  verificationVerifiedAt?: string | null;
  ownershipStatus?: 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
  ownershipDetail?: string;
  tlsStatus?: 'ready' | 'pending' | 'invalid' | 'unknown';
  tlsDetail?: string;
  certificateState?:
    | 'managed'
    | 'awaiting-route'
    | 'awaiting-dns'
    | 'provisioning'
    | 'active'
    | 'issuance-attention'
    | 'renewal-attention'
    | 'check-unavailable';
  certificateTitle?: string;
  certificateDetail?: string;
  certificateValidFrom?: string | null;
  certificateValidTo?: string | null;
  certificateSubjectName?: string | null;
  certificateIssuerName?: string | null;
  certificateSubjectAltNames?: string[];
  certificateChainSubjects?: string[];
  certificateChainEntries?: Array<{
    subjectName: string | null;
    issuerName: string | null;
    fingerprintSha256: string | null;
    serialNumber: string | null;
    isSelfIssued: boolean;
    validFrom?: string | null;
    validTo?: string | null;
  }>;
  certificateIntermediateSubjectNames?: string[];
  certificateChainDepth?: number;
  certificateRootSubjectName?: string | null;
  certificateChainChangedAt?: string | null;
  certificateChainObservedCount?: number;
  certificateChainLastHealthyAt?: string | null;
  certificateLastHealthyChainEntries?: Array<{
    subjectName: string | null;
    issuerName: string | null;
    fingerprintSha256: string | null;
    serialNumber: string | null;
    isSelfIssued: boolean;
    validFrom?: string | null;
    validTo?: string | null;
  }>;
  certificateLastHealthyIntermediateSubjectNames?: string[];
  certificateLastHealthyChainDepth?: number;
  certificatePathValidityStatus?:
    | 'valid'
    | 'expiring-soon'
    | 'expired'
    | 'not-yet-valid'
    | 'unavailable';
  certificatePathValidityTitle?: string;
  certificatePathValidityDetail?: string;
  certificatePathValidityChangedAt?: string | null;
  certificatePathValidityObservedCount?: number;
  certificatePathValidityLastHealthyAt?: string | null;
  certificateValidationReason?:
    | 'self-signed'
    | 'hostname-mismatch'
    | 'issuer-untrusted'
    | 'expired'
    | 'not-yet-valid'
    | 'validation-failed'
    | null;
  certificateFingerprintSha256?: string | null;
  certificateSerialNumber?: string | null;
  certificateFirstObservedAt?: string | null;
  certificateChangedAt?: string | null;
  certificateLastRotatedAt?: string | null;
  certificateValidityStatus?:
    | 'valid'
    | 'expiring-soon'
    | 'expired'
    | 'not-yet-valid'
    | 'unavailable';
  certificateValidityDetail?: string;
  certificateTrustStatus?:
    | 'trusted'
    | 'date-invalid'
    | 'hostname-mismatch'
    | 'self-signed'
    | 'issuer-untrusted'
    | 'validation-failed'
    | 'unavailable';
  certificateTrustDetail?: string;
  certificateIdentityStatus?:
    | 'unavailable'
    | 'first-observed'
    | 'stable'
    | 'rotated'
    | 'rotated-attention';
  certificateIdentityTitle?: string;
  certificateIdentityDetail?: string;
  certificateGuidanceState?:
    | 'healthy'
    | 'wait-for-route'
    | 'wait-for-dns'
    | 'wait-for-issuance'
    | 'renew-soon'
    | 'renew-now'
    | 'fix-coverage'
    | 'fix-trust'
    | 'refresh-checks';
  certificateGuidanceTitle?: string;
  certificateGuidanceDetail?: string;
  certificateGuidanceChangedAt?: string | null;
  certificateGuidanceObservedCount?: number;
  certificateAttentionStatus?:
    | 'healthy'
    | 'monitor'
    | 'action-needed'
    | 'persistent-action-needed';
  certificateAttentionTitle?: string;
  certificateAttentionDetail?: string;
  certificateChainStatus?:
    | 'unavailable'
    | 'leaf-only'
    | 'chained'
    | 'incomplete'
    | 'private-root'
    | 'self-signed-leaf';
  certificateChainTitle?: string;
  certificateChainDetail?: string;
  certificateChainAttentionStatus?:
    | 'healthy'
    | 'monitor'
    | 'action-needed'
    | 'persistent-action-needed';
  certificateChainAttentionTitle?: string;
  certificateChainAttentionDetail?: string;
  certificateChainHistoryStatus?:
    | 'unavailable'
    | 'baseline-missing'
    | 'stable'
    | 'rotated'
    | 'degraded'
    | 'drifted';
  certificateChainHistoryTitle?: string;
  certificateChainHistoryDetail?: string;
  diagnosticsCheckedAt?: string | null;
  diagnosticsFreshnessStatus?: 'fresh' | 'stale' | 'unchecked';
  diagnosticsFreshnessDetail?: string;
  claimState?:
    | 'managed'
    | 'publish-verification-record'
    | 'fix-verification-record'
    | 'configure-dns'
    | 'fix-dns'
    | 'refresh-checks'
    | 'redeploy-public-service'
    | 'wait-for-https'
    | 'review-https'
    | 'healthy';
  claimTitle?: string;
  claimDetail?: string;
  claimDnsRecordType?: 'CNAME' | 'TXT' | null;
  claimDnsRecordName?: string | null;
  claimDnsRecordValue?: string | null;
  verificationDnsRecordType?: 'TXT' | null;
  verificationDnsRecordName?: string | null;
  verificationDnsRecordValue?: string | null;
  routingDnsRecordType?: 'CNAME' | null;
  routingDnsRecordName?: string | null;
  routingDnsRecordValue?: string | null;
  certificateHistorySummary?: {
    eventCount: number;
    incidentCount: number;
    recoveryCount: number;
    trustIncidentCount: number;
    pathWarningCount: number;
    pathIncidentCount: number;
    chainIncidentCount: number;
    attentionIncidentCount: number;
    lastEventAt: string | null;
    lastIncidentAt: string | null;
    lastIncidentKind:
      | 'certificate_attention'
      | 'certificate_chain'
      | 'certificate_trust'
      | 'certificate_path_validity'
      | null;
    lastRecoveryAt: string | null;
    lastRecoveryKind:
      | 'certificate_attention'
      | 'certificate_chain'
      | 'certificate_trust'
      | 'certificate_path_validity'
      | null;
    lastPathWarningAt: string | null;
  };
  ownershipStatusChangedAt?: string | null;
  tlsStatusChangedAt?: string | null;
  ownershipVerifiedAt?: string | null;
  tlsReadyAt?: string | null;
  recentEvents?: ApiProjectDomainEvent[];
}

export interface ApiProjectDatabase {
  id: string;
  projectId: string;
  engine: 'postgres';
  name: string;
  status: 'pending_config' | 'provisioning' | 'ready' | 'failed';
  statusDetail: string;
  databaseName: string;
  username: string;
  password: string;
  connectionHost: string | null;
  connectionPort: number | null;
  connectionSslMode: 'disable' | 'prefer' | 'require' | null;
  healthStatus: 'unknown' | 'healthy' | 'unreachable' | 'credentials_invalid' | 'failing';
  healthStatusDetail: string;
  healthStatusChangedAt: string | null;
  lastHealthCheckAt: string | null;
  lastHealthyAt: string | null;
  lastHealthErrorAt: string | null;
  consecutiveHealthCheckFailures: number;
  credentialsRotatedAt: string | null;
  backupMode: 'none' | 'external';
  backupSchedule: 'daily' | 'weekly' | 'monthly' | 'custom' | null;
  backupRunbook: string;
  backupVerifiedAt: string | null;
  restoreVerifiedAt: string | null;
  backupCoverage: {
    status: 'missing' | 'documented' | 'backup-verified' | 'recovery-verified';
    title: string;
    detail: string;
  };
  backupExecution: {
    status: 'not-configured' | 'not-recorded' | 'scheduled' | 'overdue' | 'attention' | 'custom';
    title: string;
    detail: string;
    lastRecordedAt: string | null;
    nextDueAt: string | null;
  };
  restoreExercise: {
    status: 'not-configured' | 'not-recorded' | 'verified' | 'attention';
    title: string;
    detail: string;
    lastRecordedAt: string | null;
  };
  backupInventory: {
    status: 'missing' | 'recorded' | 'verified' | 'expiring-soon' | 'attention';
    title: string;
    detail: string;
    latestProducedAt: string | null;
    latestVerifiedAt: string | null;
    artifactCount: number;
  };
  restoreWorkflow: {
    status: 'idle' | 'awaiting-approval' | 'approved' | 'in-progress' | 'succeeded' | 'attention' | 'cancelled';
    title: string;
    detail: string;
    latestRequestedAt: string | null;
    activeRequestId: string | null;
  };
  recentEvents: Array<{
    id: string;
    kind:
      | 'provisioning'
      | 'runtime_health'
      | 'credentials'
      | 'backup_policy'
      | 'recovery_check'
      | 'backup_operation'
      | 'restore_operation'
      | 'backup_artifact'
      | 'restore_request';
    previousStatus: string | null;
    nextStatus: string;
    detail: string;
    createdAt: string;
  }>;
  recentOperations: Array<{
    id: string;
    kind: 'backup' | 'restore';
    status: 'succeeded' | 'failed';
    summary: string;
    detail: string;
    recordedAt: string;
  }>;
  backupArtifacts: Array<{
    id: string;
    label: string;
    storageProvider: 's3' | 'gcs' | 'azure' | 'local' | 'other';
    location: string;
    sizeBytes: number | null;
    producedAt: string;
    retentionExpiresAt: string | null;
    integrityStatus: 'unknown' | 'verified' | 'failed';
    lifecycleStatus: 'active' | 'archived' | 'purged';
    verifiedAt: string | null;
    lifecycleChangedAt: string;
    detail: string;
    createdAt: string;
    updatedAt: string;
  }>;
  restoreRequests: Array<{
    id: string;
    backupArtifactId: string | null;
    backupArtifactLabel: string | null;
    status: 'requested' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled';
    approvalStatus: 'pending' | 'approved' | 'rejected';
    approvalDetail: string;
    approvalReviewedAt: string | null;
    target: string;
    summary: string;
    detail: string;
    requestedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  connectionString: string | null;
  provisionedAt: string | null;
  lastProvisioningAttemptAt: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
  serviceNames: string[];
  generatedEnvironment: {
    prefix: string;
    databaseUrlKey: string;
    hostKey: string;
    portKey: string;
    databaseNameKey: string;
    usernameKey: string;
    passwordKey: string;
  };
}

export interface ApiDeployment {
  id: string;
  projectId: string;
  serviceName?: string | null;
  status: DeploymentStatus;
  commitSha: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  runtimeUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ApiQueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  prioritized: number;
}

export interface ApiQueueHealth {
  status: 'ok' | 'degraded' | 'unavailable';
  redis?: string;
  queue?: string;
  counts?: ApiQueueCounts;
  sampledAt?: string;
  message?: string;
}

export interface ApiWorkerHealth {
  status: 'ok' | 'stale' | 'unavailable';
  heartbeatKey?: string;
  staleAfterMs?: number;
  ageMs?: number;
  timestamp?: string;
  service?: string;
  pid?: number | null;
  message?: string;
}

export interface ApiServiceHealth {
  status: 'ok' | 'unavailable';
  message?: string;
}

export interface ApiEnvironmentVariable {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface ApiDeploymentLog {
  id: string;
  deploymentId: string;
  level: string;
  message: string;
  timestamp: string;
}

export interface ApiTokenRecord {
  id: string;
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tokenPreview: string;
}

export interface CreatedApiTokenRecord {
  id: string;
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  token: string;
}

export type ApiViewerAuthSource =
  | 'database-token'
  | 'bootstrap-token'
  | 'dev-user-header'
  | 'dev-admin-token';

export interface ApiViewerContext {
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  authSource: ApiViewerAuthSource;
  authMode: 'token' | 'development';
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  acceptedProjectInvitations?: Array<{
    projectId: string;
    projectName: string;
    role: 'viewer' | 'editor' | 'admin';
  }>;
}

export interface ApiDataResponse<T> {
  data: T;
}
