import type { ApiProjectDatabase } from './api';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

export function getProjectDatabaseStatusBadge(status: ApiProjectDatabase['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'ready':
      return {
        label: 'Provisioned',
        variant: 'success'
      };
    case 'provisioning':
      return {
        label: 'Provisioning',
        variant: 'info'
      };
    case 'failed':
      return {
        label: 'Provisioning Failed',
        variant: 'destructive'
      };
    case 'pending_config':
    default:
      return {
        label: 'Needs Config',
        variant: 'warning'
      };
  }
}

export function getProjectDatabaseHealthBadge(healthStatus: ApiProjectDatabase['healthStatus']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (healthStatus) {
    case 'healthy':
      return {
        label: 'Healthy',
        variant: 'success'
      };
    case 'unreachable':
      return {
        label: 'Runtime Unreachable',
        variant: 'destructive'
      };
    case 'credentials_invalid':
      return {
        label: 'Credentials Rejected',
        variant: 'destructive'
      };
    case 'failing':
      return {
        label: 'Health Query Failed',
        variant: 'warning'
      };
    case 'unknown':
    default:
      return {
        label: 'Health Unknown',
        variant: 'outline'
      };
  }
}

export function getProjectDatabaseBackupCoverageBadge(status: ApiProjectDatabase['backupCoverage']['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'recovery-verified':
      return {
        label: 'Recovery Verified',
        variant: 'success'
      };
    case 'backup-verified':
      return {
        label: 'Backup Verified',
        variant: 'info'
      };
    case 'documented':
      return {
        label: 'Runbook Documented',
        variant: 'warning'
      };
    case 'missing':
    default:
      return {
        label: 'No Coverage',
        variant: 'destructive'
      };
  }
}

export function getProjectDatabaseBackupExecutionBadge(status: ApiProjectDatabase['backupExecution']['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'scheduled':
      return {
        label: 'On Schedule',
        variant: 'success'
      };
    case 'custom':
      return {
        label: 'Custom Cadence',
        variant: 'info'
      };
    case 'attention':
      return {
        label: 'Latest Run Failed',
        variant: 'destructive'
      };
    case 'overdue':
      return {
        label: 'Backup Overdue',
        variant: 'destructive'
      };
    case 'not-recorded':
      return {
        label: 'No Run Recorded',
        variant: 'warning'
      };
    case 'not-configured':
    default:
      return {
        label: 'No Schedule',
        variant: 'outline'
      };
  }
}

export function getProjectDatabaseRestoreExerciseBadge(status: ApiProjectDatabase['restoreExercise']['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'verified':
      return {
        label: 'Restore Verified',
        variant: 'success'
      };
    case 'attention':
      return {
        label: 'Restore Failed',
        variant: 'destructive'
      };
    case 'not-recorded':
      return {
        label: 'No Drill Recorded',
        variant: 'warning'
      };
    case 'not-configured':
    default:
      return {
        label: 'No Drill Plan',
        variant: 'outline'
      };
  }
}

export function getProjectDatabaseBackupInventoryBadge(status: ApiProjectDatabase['backupInventory']['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'verified':
      return {
        label: 'Artifact Verified',
        variant: 'success'
      };
    case 'recorded':
      return {
        label: 'Artifact Recorded',
        variant: 'info'
      };
    case 'expiring-soon':
      return {
        label: 'Artifact Expiring',
        variant: 'warning'
      };
    case 'attention':
      return {
        label: 'Artifact Attention',
        variant: 'destructive'
      };
    case 'missing':
    default:
      return {
        label: 'No Artifact',
        variant: 'outline'
      };
  }
}

export function getProjectDatabaseRestoreWorkflowBadge(status: ApiProjectDatabase['restoreWorkflow']['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'awaiting-approval':
      return {
        label: 'Awaiting Approval',
        variant: 'info'
      };
    case 'approved':
      return {
        label: 'Approved To Run',
        variant: 'warning'
      };
    case 'in-progress':
      return {
        label: 'Restore In Progress',
        variant: 'warning'
      };
    case 'succeeded':
      return {
        label: 'Restore Completed',
        variant: 'success'
      };
    case 'attention':
      return {
        label: 'Restore Failed',
        variant: 'destructive'
      };
    case 'cancelled':
      return {
        label: 'Restore Cancelled',
        variant: 'outline'
      };
    case 'idle':
    default:
      return {
        label: 'No Restore Request',
        variant: 'outline'
      };
  }
}

export function formatProjectDatabaseBackupArtifactLifecycleLabel(
  status: ApiProjectDatabase['backupArtifacts'][number]['lifecycleStatus']
) {
  switch (status) {
    case 'archived':
      return 'Archived';
    case 'purged':
      return 'Purged';
    case 'active':
    default:
      return 'Active';
  }
}

export function formatProjectDatabaseBackupScheduleLabel(
  schedule: ApiProjectDatabase['backupSchedule']
) {
  switch (schedule) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'custom':
      return 'Custom';
    default:
      return 'Not set';
  }
}

export function formatProjectDatabaseEventKindLabel(
  kind: ApiProjectDatabase['recentEvents'][number]['kind']
) {
  switch (kind) {
    case 'provisioning':
      return 'Provisioning';
    case 'runtime_health':
      return 'Runtime health';
    case 'credentials':
      return 'Credentials';
    case 'backup_policy':
      return 'Backup policy';
    case 'recovery_check':
      return 'Recovery check';
    case 'backup_operation':
      return 'Backup run';
    case 'restore_operation':
      return 'Restore drill';
    case 'backup_artifact':
      return 'Backup artifact';
    case 'restore_request':
      return 'Restore request';
    default:
      return 'Database event';
  }
}

export function formatProjectDatabaseOperationKindLabel(
  kind: ApiProjectDatabase['recentOperations'][number]['kind']
) {
  return kind === 'restore' ? 'Restore drill' : 'Backup run';
}

export function formatProjectDatabaseOperationStatusLabel(
  status: ApiProjectDatabase['recentOperations'][number]['status']
) {
  return status === 'failed' ? 'Failed' : 'Succeeded';
}

export function formatProjectDatabaseBackupArtifactStorageProviderLabel(
  storageProvider: ApiProjectDatabase['backupArtifacts'][number]['storageProvider']
) {
  switch (storageProvider) {
    case 's3':
      return 'S3';
    case 'gcs':
      return 'GCS';
    case 'azure':
      return 'Azure Blob';
    case 'local':
      return 'Local';
    case 'other':
    default:
      return 'Other';
  }
}

export function formatProjectDatabaseBackupArtifactIntegrityLabel(
  integrityStatus: ApiProjectDatabase['backupArtifacts'][number]['integrityStatus']
) {
  switch (integrityStatus) {
    case 'verified':
      return 'Verified';
    case 'failed':
      return 'Failed';
    case 'unknown':
    default:
      return 'Unverified';
  }
}

export function formatProjectDatabaseRestoreRequestStatusLabel(
  status: ApiProjectDatabase['restoreRequests'][number]['status']
) {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'succeeded':
      return 'Succeeded';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'requested':
    default:
      return 'Requested';
  }
}

export function formatProjectDatabaseRestoreRequestApprovalLabel(
  status: ApiProjectDatabase['restoreRequests'][number]['approvalStatus']
) {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'pending':
    default:
      return 'Pending Approval';
  }
}

export function formatProjectDatabaseEventStatus(event: ApiProjectDatabase['recentEvents'][number]) {
  return event.previousStatus
    ? `${event.previousStatus} -> ${event.nextStatus}`
    : event.nextStatus;
}

export function summarizeProjectDatabases(input: {
  databases: ApiProjectDatabase[];
  databasesUnavailable?: boolean;
}): {
  label: string;
  variant: BadgeVariant;
  detail: string;
} {
  if (input.databasesUnavailable) {
    return {
      label: 'Unavailable',
      variant: 'warning' as const,
      detail: 'Managed database data could not be loaded for this project.'
    };
  }

  if (input.databases.length === 0) {
    return {
      label: 'None',
      variant: 'outline' as const,
      detail: 'No managed databases are configured for this project yet.'
    };
  }

  const failedProvisioningCount = input.databases.filter((database) => database.status === 'failed').length;
  const pendingConfigCount = input.databases.filter((database) => database.status === 'pending_config').length;
  const unhealthyCount = input.databases.filter((database) =>
    database.status === 'ready' && database.healthStatus !== 'healthy'
  ).length;
  const missingCoverageCount = input.databases.filter((database) =>
    database.backupCoverage.status === 'missing'
  ).length;
  const backupAttentionCount = input.databases.filter((database) =>
    database.backupExecution.status === 'attention' || database.backupExecution.status === 'overdue'
  ).length;
  const backupInventoryAttentionCount = input.databases.filter((database) =>
    database.backupInventory.status === 'attention' || database.backupInventory.status === 'expiring-soon'
  ).length;
  const restoreAttentionCount = input.databases.filter((database) =>
    database.restoreExercise.status === 'attention'
  ).length;
  const restoreWorkflowAttentionCount = input.databases.filter((database) =>
    database.restoreWorkflow.status === 'attention'
  ).length;
  const restoreWorkflowApprovalCount = input.databases.filter((database) =>
    database.restoreWorkflow.status === 'awaiting-approval'
  ).length;
  const readyCount = input.databases.filter((database) => database.status === 'ready').length;

  return {
    label: `${input.databases.length} configured`,
    variant:
      failedProvisioningCount > 0
      || unhealthyCount > 0
      || missingCoverageCount > 0
      || backupAttentionCount > 0
      || backupInventoryAttentionCount > 0
      || restoreAttentionCount > 0
      || restoreWorkflowAttentionCount > 0
        ? 'destructive'
        : pendingConfigCount > 0 || restoreWorkflowApprovalCount > 0
          ? 'warning'
          : readyCount === input.databases.length
            ? 'success'
            : 'info',
    detail:
      failedProvisioningCount > 0
        ? `${failedProvisioningCount} managed database${failedProvisioningCount === 1 ? '' : 's'} still have provisioning failures.`
        : unhealthyCount > 0
          ? `${unhealthyCount} ready managed database${unhealthyCount === 1 ? '' : 's'} need runtime follow-up.`
          : backupAttentionCount > 0
            ? `${backupAttentionCount} managed database${backupAttentionCount === 1 ? '' : 's'} have overdue or failed backup runs.`
            : backupInventoryAttentionCount > 0
              ? `${backupInventoryAttentionCount} managed database${backupInventoryAttentionCount === 1 ? '' : 's'} have artifact retention or integrity issues.`
            : restoreAttentionCount > 0
              ? `${restoreAttentionCount} managed database${restoreAttentionCount === 1 ? '' : 's'} have restore drill failures that need follow-up.`
              : restoreWorkflowAttentionCount > 0
                ? `${restoreWorkflowAttentionCount} managed database${restoreWorkflowAttentionCount === 1 ? '' : 's'} have failed restore requests that need follow-up.`
                : restoreWorkflowApprovalCount > 0
                  ? `${restoreWorkflowApprovalCount} managed database${restoreWorkflowApprovalCount === 1 ? '' : 's'} have restore requests waiting for approval.`
          : missingCoverageCount > 0
            ? `${missingCoverageCount} managed database${missingCoverageCount === 1 ? '' : 's'} still have no documented backup coverage.`
            : pendingConfigCount > 0
              ? `${pendingConfigCount} managed database${pendingConfigCount === 1 ? '' : 's'} still need platform provisioning configuration.`
              : 'All managed databases are provisioned, healthy, and have backup coverage documented.'
  };
}

export function describeProjectDatabaseServiceLinks(database: ApiProjectDatabase) {
  if (database.serviceNames.length === 0) {
    return 'No linked services yet. This database will not inject credentials into deployments until at least one service is linked.';
  }

  if (database.serviceNames.length === 1) {
    return `Injected into ${database.serviceNames[0]} deployments via generated environment variables.`;
  }

  return `Injected into ${database.serviceNames.join(', ')} deployments via generated environment variables.`;
}
