import {
  createManagedPostgresEnvKeys
} from '@vcloudrunner/shared-types';

import {
  buildManagedPostgresConnectionString
} from '../../services/managed-postgres-provisioner.service.js';
import type {
  ProjectDatabaseBackupArtifactRecord,
  ProjectDatabaseBackupSchedule,
  ProjectDatabaseEventRecord,
  ProjectDatabaseOperationRecord,
  ProjectDatabaseRecord,
  ProjectDatabaseRestoreRequestRecord,
  CreateProjectDatabaseEventInput
} from './project-databases.repository.js';
import type {
  ProjectDatabaseBackupCoverage,
  ProjectDatabaseBackupExecution,
  ProjectDatabaseBackupInventory,
  ProjectDatabaseHealthSnapshot,
  ProjectDatabaseRestoreExercise,
  ProjectDatabaseRestoreWorkflow,
  ProjectDatabaseViewRecord
} from './project-databases.service.types.js';

export function normalizeManagedDatabaseName(name: string) {
  return name.trim().toLowerCase();
}

export function sanitizeIdentifierSegment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized.length > 0 ? normalized : 'db';
}

export function createManagedIdentifier(input: {
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

export function isProjectDatabaseNameUniqueViolation(error: unknown) {
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

export function formatProjectDatabaseBackupScheduleLabel(schedule: ProjectDatabaseBackupSchedule | null) {
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

export function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isBackupArtifactRetained(artifact: ProjectDatabaseBackupArtifactRecord, now = new Date()) {
  return !artifact.retentionExpiresAt || artifact.retentionExpiresAt > now;
}

export function isBackupArtifactRestorable(artifact: ProjectDatabaseBackupArtifactRecord, now = new Date()) {
  return artifact.lifecycleStatus !== 'purged' && isBackupArtifactRetained(artifact, now);
}

export function createUnknownHealthSnapshot(
  record: ProjectDatabaseRecord,
  detail: string
): ProjectDatabaseHealthSnapshot {
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

export function buildOperationalEvents(input: {
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

export function buildBackupCoverage(record: ProjectDatabaseRecord): ProjectDatabaseBackupCoverage {
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

export function buildBackupExecution(
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

export function buildRestoreExercise(
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

export function buildBackupInventory(
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

export function buildRestoreWorkflow(
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

export function toViewRecord(
  record: ProjectDatabaseRecord,
  decryptPassword: (encrypted: string) => string,
  recentEvents: ProjectDatabaseEventRecord[] = [],
  recentOperations: ProjectDatabaseOperationRecord[] = [],
  recentBackupArtifacts: ProjectDatabaseBackupArtifactRecord[] = [],
  recentRestoreRequests: ProjectDatabaseRestoreRequestRecord[] = []
): ProjectDatabaseViewRecord {
  const password = decryptPassword(record.encryptedPassword);
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
    backupCoverage: buildBackupCoverage(record),
    backupExecution: buildBackupExecution(record, recentOperations, recentBackupArtifacts),
    restoreExercise: buildRestoreExercise(record, recentOperations),
    backupInventory: buildBackupInventory(record, recentBackupArtifacts),
    restoreWorkflow: buildRestoreWorkflow(record, recentRestoreRequests),
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
