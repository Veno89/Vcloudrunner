import { randomBytes } from 'node:crypto';
import {
  createManagedPostgresEnvKeys,
  getProjectServiceByName,
  normalizeProjectServices
} from '@vcloudrunner/shared-types';

import type { DbClient } from '../../db/client.js';
import {
  ProjectDatabaseBackupArtifactNotAllowedError,
  ProjectDatabaseBackupArtifactUnavailableError,
  ProjectDatabaseBackupArtifactNotFoundError,
  InvalidProjectServiceError,
  ProjectDatabaseAlreadyExistsError,
  ProjectDatabaseCredentialRotationFailedError,
  ProjectDatabaseCredentialRotationNotAllowedError,
  ProjectDatabaseDeprovisioningFailedError,
  ProjectDatabaseNotFoundError,
  ProjectDatabaseRecoveryCheckNotAllowedError,
  ProjectDatabaseRestoreRequestApprovalNotAllowedError,
  ProjectDatabaseRestoreRequestNotAllowedError,
  ProjectDatabaseRestoreRequestNotFoundError,
  ProjectNotFoundError
} from '../../server/domain-errors.js';
import { CryptoService } from '../../services/crypto.service.js';
import {
  buildManagedPostgresConnectionString,
  createConfiguredManagedPostgresProvisioner,
  type ManagedPostgresProvisioner
} from '../../services/managed-postgres-provisioner.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import {
  ProjectDatabasesRepository,
  type CreateProjectDatabaseEventInput,
  type ProjectDatabaseBackupMode,
  type ProjectDatabaseBackupArtifactIntegrityStatus,
  type ProjectDatabaseBackupArtifactLifecycleStatus,
  type ProjectDatabaseBackupArtifactRecord,
  type ProjectDatabaseBackupArtifactStorageProvider,
  type ProjectDatabaseBackupSchedule,
  type ProjectDatabaseEventKind,
  type ProjectDatabaseEventRecord,
  type ProjectDatabaseHealthStatus,
  type ProjectDatabaseOperationKind,
  type ProjectDatabaseOperationRecord,
  type ProjectDatabaseOperationStatus,
  type ProjectDatabaseRestoreRequestApprovalStatus,
  type ProjectDatabaseRestoreRequestRecord,
  type ProjectDatabaseRestoreRequestStatus,
  type ProjectDatabaseRecord
} from './project-databases.repository.js';

function normalizeManagedDatabaseName(name: string) {
  return name.trim().toLowerCase();
}

function sanitizeIdentifierSegment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized.length > 0 ? normalized : 'db';
}

function createManagedIdentifier(input: {
  prefix: 'db' | 'user';
  projectSlug: string;
  databaseName: string;
  suffix: string;
}) {
  const projectSlug = sanitizeIdentifierSegment(input.projectSlug);
  const databaseName = sanitizeIdentifierSegment(input.databaseName);
  const suffix = sanitizeIdentifierSegment(input.suffix);
  const maxBaseLength = 63 - input.prefix.length - suffix.length - 2;
  const base = `${projectSlug}_${databaseName}`.slice(0, Math.max(8, maxBaseLength)).replace(/_+$/g, '');

  return `${input.prefix}_${base}_${suffix}`.slice(0, 63);
}

function isProjectDatabaseNameUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const pgError = error as { code?: string; constraint?: string };
  return pgError.code === '23505' && (
    pgError.constraint === 'project_databases_project_name_unique'
    || pgError.constraint === 'project_databases_database_name_unique'
    || pgError.constraint === 'project_databases_username_unique'
  );
}

function formatProjectDatabaseBackupScheduleLabel(schedule: ProjectDatabaseBackupSchedule | null) {
  switch (schedule) {
    case 'daily':
      return 'daily';
    case 'weekly':
      return 'weekly';
    case 'monthly':
      return 'monthly';
    case 'custom':
      return 'custom';
    default:
      return 'unspecified';
  }
}

interface ProjectDatabaseHealthSnapshot {
  healthStatus: ProjectDatabaseHealthStatus;
  healthStatusDetail: string;
  healthStatusChangedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastHealthyAt: Date | null;
  lastHealthErrorAt: Date | null;
  consecutiveHealthCheckFailures: number;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isBackupArtifactRetained(artifact: ProjectDatabaseBackupArtifactRecord, now = new Date()) {
  return !artifact.retentionExpiresAt || artifact.retentionExpiresAt > now;
}

function isBackupArtifactRestorable(artifact: ProjectDatabaseBackupArtifactRecord, now = new Date()) {
  return artifact.lifecycleStatus !== 'purged' && isBackupArtifactRetained(artifact, now);
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

interface ProjectDatabasesServiceDependencies {
  projectsRepository?: ProjectsRepository;
  projectDatabasesRepository?: ProjectDatabasesRepository;
  cryptoService?: CryptoService;
  managedPostgresProvisioner?: ManagedPostgresProvisioner;
}

export class ProjectDatabasesService {
  private readonly projectsRepository: ProjectsRepository;
  private readonly projectDatabasesRepository: ProjectDatabasesRepository;
  private readonly cryptoService: CryptoService;
  private readonly managedPostgresProvisioner: ManagedPostgresProvisioner;

  constructor(
    db: DbClient,
    dependencies: ProjectDatabasesServiceDependencies = {}
  ) {
    this.projectsRepository = dependencies.projectsRepository ?? new ProjectsRepository(db);
    this.projectDatabasesRepository = dependencies.projectDatabasesRepository ?? new ProjectDatabasesRepository(db);
    this.cryptoService = dependencies.cryptoService ?? new CryptoService();
    this.managedPostgresProvisioner = dependencies.managedPostgresProvisioner ?? createConfiguredManagedPostgresProvisioner();
  }

  private buildBackupCoverage(record: ProjectDatabaseRecord): ProjectDatabaseBackupCoverage {
    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      return {
        status: 'missing',
        title: 'No backup runbook documented',
        detail:
          'Managed backup automation is not configured yet, and this database does not have an external backup/recovery runbook recorded in the platform.'
      };
    }

    const schedule = formatProjectDatabaseBackupScheduleLabel(record.backupSchedule);

    if (record.restoreVerifiedAt) {
      return {
        status: 'recovery-verified',
        title: 'External backup and restore checks recorded',
        detail:
          `External backup coverage is documented (${schedule}) and a restore drill has been recorded for this database.`
      };
    }

    if (record.backupVerifiedAt) {
      return {
        status: 'backup-verified',
        title: 'External backup checks recorded',
        detail:
          `External backup coverage is documented (${schedule}) and a recent backup verification has been recorded, but no restore drill has been recorded yet.`
      };
    }

    return {
      status: 'documented',
      title: 'External backup runbook documented',
      detail:
        `External backup coverage is documented (${schedule}), but no backup or restore verification has been recorded yet.`
    };
  }

  private buildBackupExecution(
    record: ProjectDatabaseRecord,
    recentOperations: ProjectDatabaseOperationRecord[],
    recentBackupArtifacts: ProjectDatabaseBackupArtifactRecord[]
  ): ProjectDatabaseBackupExecution {
    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      return {
        status: 'not-configured',
        title: 'No backup execution coverage',
        detail: 'Document an external backup runbook before treating this database as production-ready.',
        lastRecordedAt: null,
        nextDueAt: null
      };
    }

    const backupOperations = recentOperations.filter((operation) => operation.kind === 'backup');
    const latestUsableArtifact = recentBackupArtifacts.find((artifact) =>
      artifact.integrityStatus !== 'failed'
      && (!artifact.retentionExpiresAt || artifact.retentionExpiresAt > new Date())
    ) ?? null;
    const latestSuccess = backupOperations.find((operation) => operation.status === 'succeeded')
      ?? (record.backupVerifiedAt
        ? {
            id: 'legacy-backup-checkpoint',
            projectId: record.projectId,
            databaseId: record.id,
            kind: 'backup' as const,
            status: 'succeeded' as const,
            summary: 'Legacy backup verification checkpoint',
            detail: 'This timestamp predates first-class backup operation journaling.',
            recordedAt: record.backupVerifiedAt
          }
        : latestUsableArtifact
          ? {
              id: `artifact-${latestUsableArtifact.id}`,
              projectId: record.projectId,
              databaseId: record.id,
              kind: 'backup' as const,
              status: 'succeeded' as const,
              summary: `Recorded backup artifact "${latestUsableArtifact.label}"`,
              detail: latestUsableArtifact.detail,
              recordedAt: latestUsableArtifact.producedAt
            }
        : null);
    const latestFailure = backupOperations.find((operation) => operation.status === 'failed') ?? null;

    if (latestFailure && (!latestSuccess || latestFailure.recordedAt > latestSuccess.recordedAt)) {
      return {
        status: 'attention',
        title: 'Latest recorded backup run failed',
        detail: `The most recent recorded backup run failed ${formatProjectDatabaseBackupScheduleLabel(record.backupSchedule)} cadence expectations. Review the runbook and record a successful backup run once the issue is fixed.`,
        lastRecordedAt: latestFailure.recordedAt,
        nextDueAt: null
      };
    }

    if (!latestSuccess) {
      return {
        status: 'not-recorded',
        title: 'No backup run recorded yet',
        detail: `External backup coverage is documented (${formatProjectDatabaseBackupScheduleLabel(record.backupSchedule)}), but no successful backup run has been recorded yet.`,
        lastRecordedAt: null,
        nextDueAt: null
      };
    }

    if (record.backupSchedule === 'custom') {
      return {
        status: 'custom',
        title: 'Custom backup cadence',
        detail: 'A custom cadence is documented. Keep logging successful runs so operators can confirm the external schedule is still being met.',
        lastRecordedAt: latestSuccess.recordedAt,
        nextDueAt: null
      };
    }

    const cadenceDays = record.backupSchedule === 'weekly'
      ? 7
      : record.backupSchedule === 'monthly'
        ? 30
        : 1;
    const nextDueAt = addDays(latestSuccess.recordedAt, cadenceDays);

    if (nextDueAt <= new Date()) {
      return {
        status: 'overdue',
        title: 'Backup run is overdue',
        detail: `The last successful backup run was recorded ${formatProjectDatabaseBackupScheduleLabel(record.backupSchedule)} cadence ago. Record the next successful run or update the cadence if the schedule changed.`,
        lastRecordedAt: latestSuccess.recordedAt,
        nextDueAt
      };
    }

    return {
      status: 'scheduled',
      title: 'Backup cadence is on schedule',
      detail: `The latest successful backup run matches the documented ${formatProjectDatabaseBackupScheduleLabel(record.backupSchedule)} cadence.`,
      lastRecordedAt: latestSuccess.recordedAt,
      nextDueAt
    };
  }

  private buildRestoreExercise(
    record: ProjectDatabaseRecord,
    recentOperations: ProjectDatabaseOperationRecord[]
  ): ProjectDatabaseRestoreExercise {
    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      return {
        status: 'not-configured',
        title: 'No restore exercise coverage',
        detail: 'Document an external backup runbook before tracking restore drills for this database.',
        lastRecordedAt: null
      };
    }

    const restoreOperations = recentOperations.filter((operation) => operation.kind === 'restore');
    const latestSuccess = restoreOperations.find((operation) => operation.status === 'succeeded')
      ?? (record.restoreVerifiedAt
        ? {
            id: 'legacy-restore-checkpoint',
            projectId: record.projectId,
            databaseId: record.id,
            kind: 'restore' as const,
            status: 'succeeded' as const,
            summary: 'Legacy restore verification checkpoint',
            detail: 'This timestamp predates first-class restore operation journaling.',
            recordedAt: record.restoreVerifiedAt
          }
        : null);
    const latestFailure = restoreOperations.find((operation) => operation.status === 'failed') ?? null;

    if (latestFailure && (!latestSuccess || latestFailure.recordedAt > latestSuccess.recordedAt)) {
      return {
        status: 'attention',
        title: 'Latest restore drill failed',
        detail: 'The most recent recorded restore drill failed. Review the recovery runbook and record a successful drill once the workflow is healthy again.',
        lastRecordedAt: latestFailure.recordedAt
      };
    }

    if (!latestSuccess) {
      return {
        status: 'not-recorded',
        title: 'No restore drill recorded yet',
        detail: 'External backup coverage is documented, but no successful restore drill has been recorded yet.',
        lastRecordedAt: null
      };
    }

    return {
      status: 'verified',
      title: 'Restore drill recorded',
      detail: 'A successful restore drill has been recorded for this database.',
      lastRecordedAt: latestSuccess.recordedAt
    };
  }

  private buildBackupInventory(
    record: ProjectDatabaseRecord,
    recentBackupArtifacts: ProjectDatabaseBackupArtifactRecord[]
  ): ProjectDatabaseBackupInventory {
    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      return {
        status: 'missing',
        title: 'No backup inventory',
        detail: 'Document an external backup runbook before tracking backup artifacts for this database.',
        latestProducedAt: null,
        latestVerifiedAt: null,
        artifactCount: 0
      };
    }

    const now = new Date();
    const latestArtifact = recentBackupArtifacts[0] ?? null;
    const latestVerifiedArtifact = recentBackupArtifacts.find((artifact) =>
      artifact.integrityStatus === 'verified' && artifact.lifecycleStatus !== 'purged'
    ) ?? null;
    const latestRestorableArtifact = recentBackupArtifacts.find((artifact) =>
      isBackupArtifactRestorable(artifact, now)
    ) ?? null;

    if (!latestArtifact) {
      return {
        status: 'missing',
        title: 'No backup artifact recorded',
        detail: 'Record the latest backup artifact location so operators can prove there is a restorable snapshot behind the documented runbook.',
        latestProducedAt: null,
        latestVerifiedAt: null,
        artifactCount: 0
      };
    }

    if (!latestRestorableArtifact) {
      return {
        status: 'attention',
        title: 'No restorable artifact is currently available',
        detail: recentBackupArtifacts.some((artifact) => artifact.lifecycleStatus === 'purged')
          ? 'Every non-purged backup artifact has expired or been removed from the recovery path. Record a fresh artifact before relying on this database recovery path.'
          : 'Every recorded backup artifact has expired or fallen out of retention. Record a fresh artifact before relying on this database recovery path.',
        latestProducedAt: latestArtifact.producedAt,
        latestVerifiedAt: latestVerifiedArtifact?.verifiedAt ?? latestVerifiedArtifact?.producedAt ?? null,
        artifactCount: recentBackupArtifacts.length
      };
    }

    if (latestArtifact.integrityStatus === 'failed') {
      return {
        status: 'attention',
        title: 'Latest artifact verification failed',
        detail: latestArtifact.detail.trim().length > 0
          ? latestArtifact.detail
          : 'The most recent recorded backup artifact failed integrity verification and needs follow-up.',
        latestProducedAt: latestArtifact.producedAt,
        latestVerifiedAt: latestVerifiedArtifact?.verifiedAt ?? latestVerifiedArtifact?.producedAt ?? null,
        artifactCount: recentBackupArtifacts.length
      };
    }

    if (
      latestRestorableArtifact.retentionExpiresAt
      && latestRestorableArtifact.retentionExpiresAt <= addDays(now, 3)
    ) {
      return {
        status: 'expiring-soon',
        title: 'Latest available artifact is nearing expiry',
        detail: latestRestorableArtifact.lifecycleStatus === 'archived'
          ? 'Only an archived backup artifact remains restorable and it is nearing expiry. Record a fresh active artifact or extend retention soon.'
          : 'Record a fresh backup artifact soon or extend retention before the currently available recovery snapshot expires.',
        latestProducedAt: latestArtifact.producedAt,
        latestVerifiedAt: latestVerifiedArtifact?.verifiedAt ?? latestVerifiedArtifact?.producedAt ?? null,
        artifactCount: recentBackupArtifacts.length
      };
    }

    if (latestVerifiedArtifact) {
      return {
        status: 'verified',
        title: latestRestorableArtifact.lifecycleStatus === 'archived'
          ? 'Archived backup artifact is restorable'
          : 'Verified backup artifact available',
        detail: latestRestorableArtifact.lifecycleStatus === 'archived'
          ? 'A retained archived backup artifact is still restorable and has successful integrity verification, but no active artifact is currently marked as the primary recovery snapshot.'
          : 'A recent backup artifact is recorded with successful integrity verification and is still within retention.',
        latestProducedAt: latestArtifact.producedAt,
        latestVerifiedAt: latestVerifiedArtifact.verifiedAt ?? latestVerifiedArtifact.producedAt,
        artifactCount: recentBackupArtifacts.length
      };
    }

    return {
      status: 'recorded',
      title: latestRestorableArtifact.lifecycleStatus === 'archived'
        ? 'Archived backup artifact recorded'
        : 'Backup artifact recorded',
      detail: latestRestorableArtifact.lifecycleStatus === 'archived'
        ? 'Only an archived backup artifact is currently retained for recovery, and it has not been marked verified yet.'
        : 'A recent backup artifact is recorded and still within retention, but it has not been marked verified yet.',
      latestProducedAt: latestArtifact.producedAt,
      latestVerifiedAt: null,
      artifactCount: recentBackupArtifacts.length
    };
  }

  private buildRestoreWorkflow(
    record: ProjectDatabaseRecord,
    recentRestoreRequests: ProjectDatabaseRestoreRequestRecord[]
  ): ProjectDatabaseRestoreWorkflow {
    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      return {
        status: 'idle',
        title: 'No restore workflow',
        detail: 'Document an external backup runbook before using restore requests for this database.',
        latestRequestedAt: null,
        activeRequestId: null
      };
    }

    const latestRequest = recentRestoreRequests[0] ?? null;
    if (!latestRequest) {
      return {
        status: 'idle',
        title: 'No restore request recorded',
        detail: 'No restore requests have been recorded yet for this database.',
        latestRequestedAt: null,
        activeRequestId: null
      };
    }

    const artifactDetail = latestRequest.backupArtifactLabel
      ? ` using "${latestRequest.backupArtifactLabel}"`
      : '';

    if (latestRequest.approvalStatus === 'rejected' && latestRequest.status === 'requested') {
      return {
        status: 'attention',
        title: 'Latest restore request was rejected',
        detail: latestRequest.approvalDetail.trim().length > 0
          ? latestRequest.approvalDetail
          : `The latest restore request for ${latestRequest.target}${artifactDetail} was rejected and needs operator follow-up before another execution attempt.`,
        latestRequestedAt: latestRequest.requestedAt,
        activeRequestId: null
      };
    }

    switch (latestRequest.status) {
      case 'requested':
        return {
          status: latestRequest.approvalStatus === 'approved' ? 'approved' : 'awaiting-approval',
          title: latestRequest.approvalStatus === 'approved'
            ? 'Restore request approved'
            : 'Restore request awaiting approval',
          detail: latestRequest.approvalStatus === 'approved'
            ? `A restore request is approved for ${latestRequest.target}${artifactDetail} and is ready for operator execution.`
            : `A restore request is waiting for approval before execution for ${latestRequest.target}${artifactDetail}.`,
          latestRequestedAt: latestRequest.requestedAt,
          activeRequestId: latestRequest.id
        };
      case 'in_progress':
        return {
          status: 'in-progress',
          title: 'Restore request in progress',
          detail: `A restore request is currently in progress for ${latestRequest.target}${artifactDetail}.`,
          latestRequestedAt: latestRequest.requestedAt,
          activeRequestId: latestRequest.id
        };
      case 'failed':
        return {
          status: 'attention',
          title: 'Latest restore request failed',
          detail: latestRequest.detail.trim().length > 0
            ? latestRequest.detail
            : `The latest restore request for ${latestRequest.target}${artifactDetail} was marked failed.`,
          latestRequestedAt: latestRequest.requestedAt,
          activeRequestId: null
        };
      case 'cancelled':
        return {
          status: 'cancelled',
          title: 'Latest restore request was cancelled',
          detail: `The latest restore request for ${latestRequest.target}${artifactDetail} was cancelled.`,
          latestRequestedAt: latestRequest.requestedAt,
          activeRequestId: null
        };
      case 'succeeded':
        return {
          status: 'succeeded',
          title: 'Latest restore request completed',
          detail: `The latest restore request for ${latestRequest.target}${artifactDetail} completed successfully.`,
          latestRequestedAt: latestRequest.requestedAt,
          activeRequestId: null
        };
      default:
        return {
          status: latestRequest.approvalStatus === 'approved' ? 'approved' : 'awaiting-approval',
          title: latestRequest.approvalStatus === 'approved'
            ? 'Restore request approved'
            : 'Restore request awaiting approval',
          detail: latestRequest.approvalStatus === 'approved'
            ? `A restore request is approved for ${latestRequest.target}${artifactDetail} and is ready for operator execution.`
            : `A restore request is waiting for approval before execution for ${latestRequest.target}${artifactDetail}.`,
          latestRequestedAt: latestRequest.requestedAt,
          activeRequestId: latestRequest.id
        };
    }
  }

  private toViewRecord(
    record: ProjectDatabaseRecord,
    recentEvents: ProjectDatabaseEventRecord[] = [],
    recentOperations: ProjectDatabaseOperationRecord[] = [],
    recentBackupArtifacts: ProjectDatabaseBackupArtifactRecord[] = [],
    recentRestoreRequests: ProjectDatabaseRestoreRequestRecord[] = []
  ): ProjectDatabaseViewRecord {
    const password = this.cryptoService.decrypt(record.encryptedPassword);
    const generatedEnvironment = createManagedPostgresEnvKeys(record.name);
    const connectionString =
      record.connectionHost && record.connectionPort && record.connectionSslMode
        ? buildManagedPostgresConnectionString({
            host: record.connectionHost,
            port: record.connectionPort,
            databaseName: record.databaseName,
            username: record.username,
            password,
            sslMode: record.connectionSslMode
          })
        : null;

    return {
      ...record,
      password,
      connectionString,
      generatedEnvironment,
      backupCoverage: this.buildBackupCoverage(record),
      backupExecution: this.buildBackupExecution(record, recentOperations, recentBackupArtifacts),
      restoreExercise: this.buildRestoreExercise(record, recentOperations),
      backupInventory: this.buildBackupInventory(record, recentBackupArtifacts),
      restoreWorkflow: this.buildRestoreWorkflow(record, recentRestoreRequests),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        kind: event.kind,
        previousStatus: event.previousStatus,
        nextStatus: event.nextStatus,
        detail: event.detail,
        createdAt: event.createdAt
      })),
      recentOperations: recentOperations.map((operation) => ({
        id: operation.id,
        kind: operation.kind,
        status: operation.status,
        summary: operation.summary,
        detail: operation.detail,
        recordedAt: operation.recordedAt
      })),
      backupArtifacts: recentBackupArtifacts.map((artifact) => ({
        id: artifact.id,
        label: artifact.label,
        storageProvider: artifact.storageProvider,
        location: artifact.location,
        sizeBytes: artifact.sizeBytes,
        producedAt: artifact.producedAt,
        retentionExpiresAt: artifact.retentionExpiresAt,
        integrityStatus: artifact.integrityStatus,
        lifecycleStatus: artifact.lifecycleStatus,
        verifiedAt: artifact.verifiedAt,
        lifecycleChangedAt: artifact.lifecycleChangedAt,
        detail: artifact.detail,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt
      })),
      restoreRequests: recentRestoreRequests.map((request) => ({
        id: request.id,
        backupArtifactId: request.backupArtifactId,
        backupArtifactLabel: request.backupArtifactLabel,
        status: request.status,
        approvalStatus: request.approvalStatus,
        approvalDetail: request.approvalDetail,
        approvalReviewedAt: request.approvalReviewedAt,
        target: request.target,
        summary: request.summary,
        detail: request.detail,
        requestedAt: request.requestedAt,
        startedAt: request.startedAt,
        completedAt: request.completedAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      }))
    };
  }

  private async requireProject(projectId: string) {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return project;
  }

  private validateServiceNames(project: Awaited<ReturnType<ProjectsRepository['findById']>>, serviceNames: string[]) {
    const normalizedServices = normalizeProjectServices(project?.services);
    const deduplicated = Array.from(new Set(
      serviceNames
        .map((serviceName) => serviceName.trim())
        .filter((serviceName) => serviceName.length > 0)
    ));

    for (const serviceName of deduplicated) {
      if (!getProjectServiceByName(normalizedServices, serviceName)) {
        throw new InvalidProjectServiceError(serviceName);
      }
    }

    return deduplicated;
  }

  private createUnknownHealthSnapshot(record: ProjectDatabaseRecord, detail: string): ProjectDatabaseHealthSnapshot {
    const changedAt = record.healthStatus === 'unknown'
      ? record.healthStatusChangedAt
      : new Date();

    return {
      healthStatus: 'unknown',
      healthStatusDetail: detail,
      healthStatusChangedAt: changedAt,
      lastHealthCheckAt: record.lastHealthCheckAt,
      lastHealthyAt: record.lastHealthyAt,
      lastHealthErrorAt: record.lastHealthErrorAt,
      consecutiveHealthCheckFailures: 0
    };
  }

  private async inspectRuntimeHealth(input: {
    record: ProjectDatabaseRecord;
    password: string;
    status: ProjectDatabaseViewRecord['status'];
    connectionHost: string | null;
    connectionPort: number | null;
    connectionSslMode: 'disable' | 'prefer' | 'require' | null;
  }): Promise<ProjectDatabaseHealthSnapshot> {
    if (input.status !== 'ready') {
      return this.createUnknownHealthSnapshot(
        input.record,
        'Runtime health checks are waiting for managed Postgres provisioning to reach a ready state.'
      );
    }

    const healthResult = await this.managedPostgresProvisioner.checkHealth({
      databaseName: input.record.databaseName,
      username: input.record.username,
      password: input.password,
      connectionHost: input.connectionHost,
      connectionPort: input.connectionPort,
      connectionSslMode: input.connectionSslMode
    });

    if (healthResult.status === 'unknown' || !healthResult.checkedAt) {
      return this.createUnknownHealthSnapshot(input.record, healthResult.statusDetail);
    }

    return {
      healthStatus: healthResult.status,
      healthStatusDetail: healthResult.statusDetail,
      healthStatusChangedAt:
        input.record.healthStatus === healthResult.status
          ? input.record.healthStatusChangedAt
          : healthResult.checkedAt,
      lastHealthCheckAt: healthResult.checkedAt,
      lastHealthyAt:
        healthResult.status === 'healthy'
          ? healthResult.checkedAt
          : input.record.lastHealthyAt,
      lastHealthErrorAt:
        healthResult.status === 'healthy'
          ? input.record.lastHealthErrorAt
          : healthResult.checkedAt,
      consecutiveHealthCheckFailures:
        healthResult.status === 'healthy'
          ? 0
          : input.record.healthStatus === healthResult.status
            ? input.record.consecutiveHealthCheckFailures + 1
            : 1
    };
  }

  private buildOperationalEvents(input: {
    previous: ProjectDatabaseRecord;
    next: ProjectDatabaseRecord;
  }): CreateProjectDatabaseEventInput[] {
    const events: CreateProjectDatabaseEventInput[] = [];

    if (input.previous.status !== input.next.status) {
      events.push({
        projectId: input.next.projectId,
        databaseId: input.next.id,
        kind: 'provisioning',
        previousStatus: input.previous.status,
        nextStatus: input.next.status,
        detail: input.next.statusDetail,
        createdAt: input.next.lastProvisioningAttemptAt ?? new Date()
      });
    }

    if (input.previous.healthStatus !== input.next.healthStatus) {
      events.push({
        projectId: input.next.projectId,
        databaseId: input.next.id,
        kind: 'runtime_health',
        previousStatus: input.previous.healthStatus,
        nextStatus: input.next.healthStatus,
        detail: input.next.healthStatusDetail,
        createdAt: input.next.lastHealthCheckAt ?? new Date()
      });
    }

    return events;
  }

  private async persistProvisioningState(input: {
    record: ProjectDatabaseRecord;
    password: string;
    encryptedPassword?: string;
    credentialsRotatedAt?: Date | null;
    statusDetailOverride?: string;
  }) {
    const attemptedAt = new Date();
    const result = await this.managedPostgresProvisioner.provision({
      databaseName: input.record.databaseName,
      username: input.record.username,
      password: input.password
    });

    const healthSnapshot = await this.inspectRuntimeHealth({
      record: input.record,
      password: input.password,
      status: result.status,
      connectionHost: result.connectionHost,
      connectionPort: result.connectionPort,
      connectionSslMode: result.connectionSslMode
    });

    const updated = await this.projectDatabasesRepository.updateOperationalState({
      projectId: input.record.projectId,
      databaseId: input.record.id,
      status: result.status,
      statusDetail:
        result.status === 'ready' && input.statusDetailOverride
          ? input.statusDetailOverride
          : result.statusDetail,
      connectionHost: result.connectionHost,
      connectionPort: result.connectionPort,
      connectionSslMode: result.connectionSslMode,
      healthStatus: healthSnapshot.healthStatus,
      healthStatusDetail: healthSnapshot.healthStatusDetail,
      healthStatusChangedAt: healthSnapshot.healthStatusChangedAt,
      lastHealthCheckAt: healthSnapshot.lastHealthCheckAt,
      lastHealthyAt: healthSnapshot.lastHealthyAt,
      lastHealthErrorAt: healthSnapshot.lastHealthErrorAt,
      consecutiveHealthCheckFailures: healthSnapshot.consecutiveHealthCheckFailures,
      provisionedAt: result.provisionedAt ?? input.record.provisionedAt,
      lastProvisioningAttemptAt: attemptedAt,
      lastErrorAt: result.lastErrorAt,
      ...(input.encryptedPassword ? { encryptedPassword: input.encryptedPassword } : {}),
      ...(input.credentialsRotatedAt !== undefined
        ? { credentialsRotatedAt: input.credentialsRotatedAt }
        : {})
    });

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    const events = this.buildOperationalEvents({
      previous: input.record,
      next: updated
    });

    if (events.length > 0) {
      await this.projectDatabasesRepository.createEvents(events);
    }

    return updated;
  }

  private async loadRecentDatabaseCollections(databaseId: string) {
    const [
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    ] = await Promise.all([
      this.projectDatabasesRepository.listRecentEventsByDatabaseIds([databaseId]),
      this.projectDatabasesRepository.listRecentOperationsByDatabaseIds([databaseId]),
      this.projectDatabasesRepository.listRecentBackupArtifactsByDatabaseIds([databaseId]),
      this.projectDatabasesRepository.listRecentRestoreRequestsByDatabaseIds([databaseId])
    ]);

    return {
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    };
  }

  async listProjectDatabases(projectId: string): Promise<ProjectDatabaseViewRecord[]> {
    await this.requireProject(projectId);
    const records = await this.projectDatabasesRepository.listByProject(projectId);
    const recentEvents = await this.projectDatabasesRepository.listRecentEventsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentOperations = await this.projectDatabasesRepository.listRecentOperationsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentBackupArtifacts = await this.projectDatabasesRepository.listRecentBackupArtifactsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentRestoreRequests = await this.projectDatabasesRepository.listRecentRestoreRequestsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentEventsByDatabaseId = new Map<string, ProjectDatabaseEventRecord[]>();
    const recentOperationsByDatabaseId = new Map<string, ProjectDatabaseOperationRecord[]>();
    const recentBackupArtifactsByDatabaseId = new Map<string, ProjectDatabaseBackupArtifactRecord[]>();
    const recentRestoreRequestsByDatabaseId = new Map<string, ProjectDatabaseRestoreRequestRecord[]>();

    for (const event of recentEvents) {
      const items = recentEventsByDatabaseId.get(event.databaseId) ?? [];
      items.push(event);
      recentEventsByDatabaseId.set(event.databaseId, items);
    }

    for (const operation of recentOperations) {
      const items = recentOperationsByDatabaseId.get(operation.databaseId) ?? [];
      items.push(operation);
      recentOperationsByDatabaseId.set(operation.databaseId, items);
    }

    for (const artifact of recentBackupArtifacts) {
      const items = recentBackupArtifactsByDatabaseId.get(artifact.databaseId) ?? [];
      items.push(artifact);
      recentBackupArtifactsByDatabaseId.set(artifact.databaseId, items);
    }

    for (const request of recentRestoreRequests) {
      const items = recentRestoreRequestsByDatabaseId.get(request.databaseId) ?? [];
      items.push(request);
      recentRestoreRequestsByDatabaseId.set(request.databaseId, items);
    }

    return records.map((record) =>
      this.toViewRecord(
        record,
        recentEventsByDatabaseId.get(record.id) ?? [],
        recentOperationsByDatabaseId.get(record.id) ?? [],
        recentBackupArtifactsByDatabaseId.get(record.id) ?? [],
        recentRestoreRequestsByDatabaseId.get(record.id) ?? []
      )
    );
  }

  async createProjectDatabase(input: {
    projectId: string;
    name: string;
    serviceNames: string[];
  }): Promise<ProjectDatabaseViewRecord> {
    const project = await this.requireProject(input.projectId);
    const normalizedName = normalizeManagedDatabaseName(input.name);
    const validatedServiceNames = this.validateServiceNames(project, input.serviceNames);
    const suffix = randomBytes(3).toString('hex');
    const databaseName = createManagedIdentifier({
      prefix: 'db',
      projectSlug: project.slug,
      databaseName: normalizedName,
      suffix
    });
    const username = createManagedIdentifier({
      prefix: 'user',
      projectSlug: project.slug,
      databaseName: normalizedName,
      suffix
    });
    const password = randomBytes(18).toString('hex');
    const encryptedPassword = this.cryptoService.encrypt(password);

    let created: ProjectDatabaseRecord;
    try {
      created = await this.projectDatabasesRepository.create({
        projectId: input.projectId,
        engine: 'postgres',
        name: normalizedName,
        status: 'provisioning',
        statusDetail: 'Provisioning managed Postgres credentials and database resources.',
        databaseName,
        username,
        encryptedPassword,
        serviceNames: validatedServiceNames
      });
    } catch (error) {
      if (isProjectDatabaseNameUniqueViolation(error)) {
        throw new ProjectDatabaseAlreadyExistsError();
      }

      throw error;
    }

    const provisioned = await this.persistProvisioningState({
      record: created,
      password
    });
    return this.toViewRecord(provisioned);
  }

  async reconcileProjectDatabase(input: {
    projectId: string;
    databaseId: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const password = this.cryptoService.decrypt(record.encryptedPassword);
    const provisioned = await this.persistProvisioningState({
      record,
      password
    });
    return this.toViewRecord(provisioned);
  }

  async rotateProjectDatabaseCredentials(input: {
    projectId: string;
    databaseId: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (
      record.status !== 'ready'
      || !record.connectionHost
      || !record.connectionPort
      || !record.connectionSslMode
    ) {
      throw new ProjectDatabaseCredentialRotationNotAllowedError();
    }

    const previousPassword = this.cryptoService.decrypt(record.encryptedPassword);
    const nextPassword = randomBytes(18).toString('hex');
    const encryptedPassword = this.cryptoService.encrypt(nextPassword);
    const rotationResult = await this.managedPostgresProvisioner.rotateCredentials({
      databaseName: record.databaseName,
      username: record.username,
      previousPassword,
      nextPassword,
      connectionHost: record.connectionHost,
      connectionPort: record.connectionPort,
      connectionSslMode: record.connectionSslMode
    });

    if (rotationResult.status !== 'rotated' || !rotationResult.rotatedAt) {
      throw new ProjectDatabaseCredentialRotationFailedError(rotationResult.statusDetail);
    }

    const rotated = await this.persistProvisioningState({
      record,
      password: nextPassword,
      encryptedPassword,
      credentialsRotatedAt: rotationResult.rotatedAt,
      statusDetailOverride: rotationResult.statusDetail
    });

    await this.projectDatabasesRepository.createEvents([{
      projectId: rotated.projectId,
      databaseId: rotated.id,
      kind: 'credentials',
      previousStatus: record.credentialsRotatedAt ? 'rotated' : 'active',
      nextStatus: 'rotated',
      detail: rotationResult.statusDetail,
      createdAt: rotationResult.rotatedAt
    }]);

    return this.toViewRecord(rotated);
  }

  async updateProjectDatabaseBackupPolicy(input: {
    projectId: string;
    databaseId: string;
    backupMode: ProjectDatabaseBackupMode;
    backupSchedule: ProjectDatabaseBackupSchedule | null;
    backupRunbook: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const normalizedRunbook = input.backupRunbook.trim();
    const normalizedSchedule = input.backupMode === 'external' ? input.backupSchedule : null;
    const normalizedMode = input.backupMode;
    const updated = await this.projectDatabasesRepository.updateBackupPolicy({
      projectId: input.projectId,
      databaseId: input.databaseId,
      backupMode: normalizedMode,
      backupSchedule: normalizedSchedule,
      backupRunbook: normalizedMode === 'external' ? normalizedRunbook : ''
    });

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    const previousCoverage = this.buildBackupCoverage(record);
    const nextCoverage = this.buildBackupCoverage(updated);

    if (
      previousCoverage.status !== nextCoverage.status
      || record.backupMode !== updated.backupMode
      || record.backupSchedule !== updated.backupSchedule
      || record.backupRunbook !== updated.backupRunbook
    ) {
      await this.projectDatabasesRepository.createEvents([{
        projectId: updated.projectId,
        databaseId: updated.id,
        kind: 'backup_policy',
        previousStatus: previousCoverage.status,
        nextStatus: nextCoverage.status,
        detail: nextCoverage.detail,
        createdAt: new Date()
      }]);
    }

    return this.toViewRecord(updated);
  }

  async recordProjectDatabaseRecoveryCheck(input: {
    projectId: string;
    databaseId: string;
    kind: 'backup' | 'restore';
    status?: ProjectDatabaseOperationStatus;
    summary?: string;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      throw new ProjectDatabaseRecoveryCheckNotAllowedError();
    }

    const status = input.status ?? 'succeeded';
    const summary = input.summary?.trim().length
      ? input.summary.trim()
      : status === 'failed'
        ? input.kind === 'backup'
          ? 'External backup run failed'
          : 'External restore drill failed'
        : input.kind === 'backup'
          ? 'External backup run recorded'
          : 'External restore drill recorded';
    const detail = input.detail?.trim() ?? '';
    const recordedAt = new Date();
    const operation = await this.projectDatabasesRepository.createOperation({
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: input.kind,
      status,
      summary,
      detail,
      recordedAt
    });

    const updated = status === 'succeeded'
      ? await this.projectDatabasesRepository.recordRecoveryCheck({
          projectId: input.projectId,
          databaseId: input.databaseId,
          kind: input.kind,
          verifiedAt: recordedAt
        })
      : record;

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    const [event] = await this.projectDatabasesRepository.createEvents([{
      projectId: updated.projectId,
      databaseId: updated.id,
      kind: input.kind === 'backup' ? 'backup_operation' : 'restore_operation',
      previousStatus: null,
      nextStatus: status,
      detail: detail.length > 0 ? `${summary}: ${detail}` : summary,
      createdAt: recordedAt
    }]);

    return this.toViewRecord(
      updated,
      event ? [event] : [],
      [operation]
    );
  }

  async recordProjectDatabaseBackupArtifact(input: {
    projectId: string;
    databaseId: string;
    label: string;
    storageProvider: ProjectDatabaseBackupArtifactStorageProvider;
    location: string;
    sizeBytes: number | null;
    producedAt: Date;
    retentionExpiresAt: Date | null;
    integrityStatus?: ProjectDatabaseBackupArtifactIntegrityStatus;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      throw new ProjectDatabaseBackupArtifactNotAllowedError();
    }

    const artifact = await this.projectDatabasesRepository.createBackupArtifact({
      projectId: input.projectId,
      databaseId: input.databaseId,
      label: input.label.trim(),
      storageProvider: input.storageProvider,
      location: input.location.trim(),
      sizeBytes: input.sizeBytes,
      producedAt: input.producedAt,
      retentionExpiresAt: input.retentionExpiresAt,
      integrityStatus: input.integrityStatus ?? 'unknown',
      lifecycleStatus: 'active',
      verifiedAt: input.integrityStatus === 'verified' ? new Date() : null,
      lifecycleChangedAt: new Date(),
      detail: input.detail?.trim() ?? ''
    });

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'backup_artifact',
      previousStatus: null,
      nextStatus:
        artifact.integrityStatus === 'verified'
          ? 'verified'
          : artifact.integrityStatus === 'failed'
            ? 'failed'
            : 'recorded',
      detail:
        artifact.detail.trim().length > 0
          ? `Recorded backup artifact "${artifact.label}" at ${artifact.location}: ${artifact.detail}`
          : `Recorded backup artifact "${artifact.label}" at ${artifact.location}`,
      createdAt: new Date()
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.toViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async updateProjectDatabaseBackupArtifact(input: {
    projectId: string;
    databaseId: string;
    backupArtifactId: string;
    integrityStatus: ProjectDatabaseBackupArtifactIntegrityStatus;
    lifecycleStatus: ProjectDatabaseBackupArtifactLifecycleStatus;
    retentionExpiresAt: Date | null;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const existing = await this.projectDatabasesRepository.findBackupArtifactById(
      input.projectId,
      input.databaseId,
      input.backupArtifactId
    );
    if (!existing) {
      throw new ProjectDatabaseBackupArtifactNotFoundError();
    }

    const detail = input.detail?.trim() ?? '';
    const now = new Date();
    const updated = await this.projectDatabasesRepository.updateBackupArtifact({
      projectId: input.projectId,
      databaseId: input.databaseId,
      backupArtifactId: input.backupArtifactId,
      integrityStatus: input.integrityStatus,
      lifecycleStatus: input.lifecycleStatus,
      retentionExpiresAt: input.retentionExpiresAt,
      verifiedAt:
        input.integrityStatus === 'verified'
          ? existing.verifiedAt ?? now
          : existing.verifiedAt,
      lifecycleChangedAt:
        input.lifecycleStatus === existing.lifecycleStatus
          ? existing.lifecycleChangedAt
          : now,
      detail
    });

    if (!updated) {
      throw new ProjectDatabaseBackupArtifactNotFoundError();
    }

    const changedParts: string[] = [];
    if (existing.integrityStatus !== updated.integrityStatus) {
      changedParts.push(`integrity ${existing.integrityStatus} -> ${updated.integrityStatus}`);
    }
    if (existing.lifecycleStatus !== updated.lifecycleStatus) {
      changedParts.push(`lifecycle ${existing.lifecycleStatus} -> ${updated.lifecycleStatus}`);
    }
    if (
      (existing.retentionExpiresAt?.toISOString() ?? null)
      !== (updated.retentionExpiresAt?.toISOString() ?? null)
    ) {
      changedParts.push(
        updated.retentionExpiresAt
          ? `retention now expires ${updated.retentionExpiresAt.toISOString()}`
          : 'retention expiry cleared'
      );
    }
    if (existing.detail !== updated.detail && detail.length > 0) {
      changedParts.push(`notes: ${detail}`);
    }

    if (changedParts.length > 0) {
      await this.projectDatabasesRepository.createEvents([{
        projectId: input.projectId,
        databaseId: input.databaseId,
        kind: 'backup_artifact',
        previousStatus: `${existing.lifecycleStatus}:${existing.integrityStatus}`,
        nextStatus: `${updated.lifecycleStatus}:${updated.integrityStatus}`,
        detail: `Updated backup artifact "${updated.label}": ${changedParts.join('; ')}`,
        createdAt: now
      }]);
    }

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.toViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async createProjectDatabaseRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    backupArtifactId?: string | null;
    target: string;
    summary: string;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      throw new ProjectDatabaseRestoreRequestNotAllowedError();
    }

    let backupArtifact: ProjectDatabaseBackupArtifactRecord | null = null;
    if (input.backupArtifactId) {
      backupArtifact = await this.projectDatabasesRepository.findBackupArtifactById(
        input.projectId,
        input.databaseId,
        input.backupArtifactId
      );

      if (!backupArtifact) {
        throw new ProjectDatabaseBackupArtifactNotFoundError();
      }

      if (!isBackupArtifactRestorable(backupArtifact)) {
        throw new ProjectDatabaseBackupArtifactUnavailableError();
      }
    }

    const request = await this.projectDatabasesRepository.createRestoreRequest({
      projectId: input.projectId,
      databaseId: input.databaseId,
      backupArtifactId: backupArtifact?.id ?? null,
      target: input.target.trim(),
      summary: input.summary.trim(),
      detail: input.detail?.trim() ?? '',
      requestedAt: new Date()
    });

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'restore_request',
      previousStatus: null,
      nextStatus: `${request.approvalStatus}:${request.status}`,
      detail:
        request.detail.trim().length > 0
          ? `${request.summary} (${request.target})${request.backupArtifactLabel ? ` using "${request.backupArtifactLabel}"` : ''}: ${request.detail}`
          : `${request.summary} (${request.target})${request.backupArtifactLabel ? ` using "${request.backupArtifactLabel}"` : ''}`,
      createdAt: request.requestedAt
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.toViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async reviewProjectDatabaseRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    restoreRequestId: string;
    approvalStatus: ProjectDatabaseRestoreRequestApprovalStatus;
    approvalDetail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const existing = await this.projectDatabasesRepository.findRestoreRequestById(
      input.projectId,
      input.databaseId,
      input.restoreRequestId
    );
    if (!existing) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    if (existing.status !== 'requested') {
      throw new ProjectDatabaseRestoreRequestApprovalNotAllowedError();
    }

    const approvalReviewedAt = new Date();
    const approvalDetail = input.approvalDetail?.trim() ?? '';
    const updated = await this.projectDatabasesRepository.reviewRestoreRequest({
      projectId: input.projectId,
      databaseId: input.databaseId,
      restoreRequestId: input.restoreRequestId,
      approvalStatus: input.approvalStatus,
      approvalDetail,
      approvalReviewedAt
    });

    if (!updated) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'restore_request',
      previousStatus: `${existing.approvalStatus}:${existing.status}`,
      nextStatus: `${updated.approvalStatus}:${updated.status}`,
      detail:
        approvalDetail.length > 0
          ? `${updated.summary} (${updated.target}) review: ${approvalDetail}`
          : input.approvalStatus === 'approved'
            ? `Restore request "${updated.summary}" for ${updated.target} was approved for execution.`
            : `Restore request "${updated.summary}" for ${updated.target} was rejected.`,
      createdAt: approvalReviewedAt
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.toViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async updateProjectDatabaseRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    restoreRequestId: string;
    status: ProjectDatabaseRestoreRequestStatus;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const existing = await this.projectDatabasesRepository.findRestoreRequestById(
      input.projectId,
      input.databaseId,
      input.restoreRequestId
    );
    if (!existing) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    if (
      (input.status === 'in_progress' || input.status === 'succeeded' || input.status === 'failed')
      && existing.approvalStatus !== 'approved'
    ) {
      throw new ProjectDatabaseRestoreRequestApprovalNotAllowedError();
    }

    const updated = await this.projectDatabasesRepository.updateRestoreRequest({
      projectId: input.projectId,
      databaseId: input.databaseId,
      restoreRequestId: input.restoreRequestId,
      status: input.status,
      detail: input.detail?.trim() ?? '',
      startedAt:
        input.status === 'in_progress'
          ? existing.startedAt ?? new Date()
          : input.status === 'requested'
            ? null
            : existing.startedAt,
      completedAt:
        input.status === 'succeeded' || input.status === 'failed' || input.status === 'cancelled'
          ? new Date()
          : null
    });
    if (!updated) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'restore_request',
      previousStatus: `${existing.approvalStatus}:${existing.status}`,
      nextStatus: `${updated.approvalStatus}:${updated.status}`,
      detail:
        updated.detail.trim().length > 0
          ? `${updated.summary} (${updated.target})${updated.backupArtifactLabel ? ` using "${updated.backupArtifactLabel}"` : ''}: ${updated.detail}`
          : `${updated.summary} (${updated.target})${updated.backupArtifactLabel ? ` using "${updated.backupArtifactLabel}"` : ''}`,
      createdAt: new Date()
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.toViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async getProjectDatabaseAuditExport(input: {
    projectId: string;
    databaseId: string;
  }): Promise<ProjectDatabaseAuditExport> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const [
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    ] = await Promise.all([
      this.projectDatabasesRepository.listRecentEventsByDatabaseIds([record.id], 50),
      this.projectDatabasesRepository.listRecentOperationsByDatabaseIds([record.id], 50),
      this.projectDatabasesRepository.listRecentBackupArtifactsByDatabaseIds([record.id], 50),
      this.projectDatabasesRepository.listRecentRestoreRequestsByDatabaseIds([record.id], 50)
    ]);

    const database = this.toViewRecord(
      record,
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    );

    return {
      exportedAt: new Date(),
      database,
      events: database.recentEvents,
      operations: database.recentOperations,
      backupArtifacts: database.backupArtifacts,
      restoreRequests: database.restoreRequests
    };
  }

  async updateProjectDatabaseServiceLinks(input: {
    projectId: string;
    databaseId: string;
    serviceNames: string[];
  }): Promise<ProjectDatabaseViewRecord> {
    const project = await this.requireProject(input.projectId);
    const validatedServiceNames = this.validateServiceNames(project, input.serviceNames);
    const updated = await this.projectDatabasesRepository.replaceServiceLinks({
      projectId: input.projectId,
      databaseId: input.databaseId,
      serviceNames: validatedServiceNames
    });

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    return this.toViewRecord(updated);
  }

  async removeProjectDatabase(input: {
    projectId: string;
    databaseId: string;
  }): Promise<void> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.provisionedAt || record.status === 'ready') {
      try {
        await this.managedPostgresProvisioner.deprovision({
          databaseName: record.databaseName,
          username: record.username
        });
      } catch {
        throw new ProjectDatabaseDeprovisioningFailedError();
      }
    }

    const deleted = await this.projectDatabasesRepository.delete(input.projectId, input.databaseId);
    if (!deleted) {
      throw new ProjectDatabaseNotFoundError();
    }
  }

  async listInjectedEnvironmentForProjectService(input: {
    projectId: string;
    serviceName: string;
  }): Promise<Record<string, string>> {
    const records = await this.projectDatabasesRepository.listLinkedReadyByProjectService(
      input.projectId,
      input.serviceName
    );

    return records.reduce<Record<string, string>>((envVars, record) => {
      if (!record.connectionHost || !record.connectionPort || !record.connectionSslMode) {
        return envVars;
      }

      const password = this.cryptoService.decrypt(record.encryptedPassword);
      const generatedEnvironment = createManagedPostgresEnvKeys(record.name);
      const connectionString = buildManagedPostgresConnectionString({
        host: record.connectionHost,
        port: record.connectionPort,
        databaseName: record.databaseName,
        username: record.username,
        password,
        sslMode: record.connectionSslMode
      });

      return {
        ...envVars,
        [generatedEnvironment.databaseUrlKey]: connectionString,
        [generatedEnvironment.hostKey]: record.connectionHost,
        [generatedEnvironment.portKey]: String(record.connectionPort),
        [generatedEnvironment.databaseNameKey]: record.databaseName,
        [generatedEnvironment.usernameKey]: record.username,
        [generatedEnvironment.passwordKey]: password
      };
    }, {});
  }
}
