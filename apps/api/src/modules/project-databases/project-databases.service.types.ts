import type { createManagedPostgresEnvKeys } from '@vcloudrunner/shared-types';
import type {
  ProjectDatabaseBackupArtifactIntegrityStatus,
  ProjectDatabaseBackupArtifactLifecycleStatus,
  ProjectDatabaseBackupArtifactStorageProvider,
  ProjectDatabaseBackupMode,
  ProjectDatabaseBackupSchedule,
  ProjectDatabaseEventKind,
  ProjectDatabaseHealthStatus,
  ProjectDatabaseOperationKind,
  ProjectDatabaseOperationStatus,
  ProjectDatabaseRestoreRequestApprovalStatus,
  ProjectDatabaseRestoreRequestStatus
} from './project-databases.repository.js';

export interface ProjectDatabaseHealthSnapshot {
  healthStatus: ProjectDatabaseHealthStatus;
  healthStatusDetail: string;
  healthStatusChangedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastHealthyAt: Date | null;
  lastHealthErrorAt: Date | null;
  consecutiveHealthCheckFailures: number;
}

export interface ProjectDatabaseBackupCoverage {
  status: 'missing' | 'documented' | 'backup-verified' | 'recovery-verified';
  title: string;
  detail: string;
}

export interface ProjectDatabaseRecentEvent {
  id: string;
  kind: ProjectDatabaseEventKind;
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: Date;
}

export interface ProjectDatabaseOperationView {
  id: string;
  kind: ProjectDatabaseOperationKind;
  status: ProjectDatabaseOperationStatus;
  summary: string;
  detail: string;
  recordedAt: Date;
}

export interface ProjectDatabaseBackupExecution {
  status: 'not-configured' | 'not-recorded' | 'scheduled' | 'overdue' | 'attention' | 'custom';
  title: string;
  detail: string;
  lastRecordedAt: Date | null;
  nextDueAt: Date | null;
}

export interface ProjectDatabaseRestoreExercise {
  status: 'not-configured' | 'not-recorded' | 'verified' | 'attention';
  title: string;
  detail: string;
  lastRecordedAt: Date | null;
}

export interface ProjectDatabaseBackupArtifactView {
  id: string;
  label: string;
  storageProvider: ProjectDatabaseBackupArtifactStorageProvider;
  location: string;
  sizeBytes: number | null;
  producedAt: Date;
  retentionExpiresAt: Date | null;
  integrityStatus: ProjectDatabaseBackupArtifactIntegrityStatus;
  lifecycleStatus: ProjectDatabaseBackupArtifactLifecycleStatus;
  verifiedAt: Date | null;
  lifecycleChangedAt: Date;
  detail: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDatabaseBackupInventory {
  status: 'missing' | 'recorded' | 'verified' | 'expiring-soon' | 'attention';
  title: string;
  detail: string;
  latestProducedAt: Date | null;
  latestVerifiedAt: Date | null;
  artifactCount: number;
}

export interface ProjectDatabaseRestoreRequestView {
  id: string;
  backupArtifactId: string | null;
  backupArtifactLabel: string | null;
  status: ProjectDatabaseRestoreRequestStatus;
  approvalStatus: ProjectDatabaseRestoreRequestApprovalStatus;
  approvalDetail: string;
  approvalReviewedAt: Date | null;
  target: string;
  summary: string;
  detail: string;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDatabaseRestoreWorkflow {
  status:
    | 'idle'
    | 'awaiting-approval'
    | 'approved'
    | 'in-progress'
    | 'succeeded'
    | 'attention'
    | 'cancelled';
  title: string;
  detail: string;
  latestRequestedAt: Date | null;
  activeRequestId: string | null;
}

export interface ProjectDatabaseAuditExport {
  exportedAt: Date;
  database: ProjectDatabaseViewRecord;
  events: ProjectDatabaseRecentEvent[];
  operations: ProjectDatabaseOperationView[];
  backupArtifacts: ProjectDatabaseBackupArtifactView[];
  restoreRequests: ProjectDatabaseRestoreRequestView[];
}

export interface ProjectDatabaseViewRecord {
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
  healthStatus: ProjectDatabaseHealthStatus;
  healthStatusDetail: string;
  healthStatusChangedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastHealthyAt: Date | null;
  lastHealthErrorAt: Date | null;
  consecutiveHealthCheckFailures: number;
  credentialsRotatedAt: Date | null;
  backupMode: ProjectDatabaseBackupMode;
  backupSchedule: ProjectDatabaseBackupSchedule | null;
  backupRunbook: string;
  backupVerifiedAt: Date | null;
  restoreVerifiedAt: Date | null;
  backupCoverage: ProjectDatabaseBackupCoverage;
  backupExecution: ProjectDatabaseBackupExecution;
  restoreExercise: ProjectDatabaseRestoreExercise;
  backupInventory: ProjectDatabaseBackupInventory;
  restoreWorkflow: ProjectDatabaseRestoreWorkflow;
  recentEvents: ProjectDatabaseRecentEvent[];
  recentOperations: ProjectDatabaseOperationView[];
  backupArtifacts: ProjectDatabaseBackupArtifactView[];
  restoreRequests: ProjectDatabaseRestoreRequestView[];
  connectionString: string | null;
  provisionedAt: Date | null;
  lastProvisioningAttemptAt: Date | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  serviceNames: string[];
  generatedEnvironment: ReturnType<typeof createManagedPostgresEnvKeys>;
}
