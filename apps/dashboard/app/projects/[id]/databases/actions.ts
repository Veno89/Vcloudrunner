'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { createViewerContextFailureRedirect } from '@/lib/dashboard-action-auth';
import { buildDashboardAccountSetupHref } from '@/lib/dashboard-auth-navigation';
import {
  createProjectDatabaseRestoreRequest,
  createProjectDatabase,
  recordProjectDatabaseBackupArtifact,
  recordProjectDatabaseRecoveryCheck,
  reconcileProjectDatabase,
  removeProjectDatabase,
  reviewProjectDatabaseRestoreRequest,
  rotateProjectDatabaseCredentials,
  resolveViewerContext,
  updateProjectDatabaseBackupArtifact,
  updateProjectDatabaseRestoreRequest,
  updateProjectDatabaseBackupPolicy,
  updateProjectDatabaseServiceLinks
} from '@/lib/api';
import { extractApiStatusCode } from '@/lib/helpers';

function normalizeActionReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') {
    return '/projects';
  }

  const normalized = value.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return '/projects';
  }

  return normalized;
}

function normalizeServiceNames(formData: FormData) {
  return Array.from(new Set(
    formData
      .getAll('serviceName')
      .flatMap((value) => typeof value === 'string' ? [value.trim()] : [])
      .filter((value) => value.length > 0)
  ));
}

function normalizeBackupMode(value: FormDataEntryValue | null): 'none' | 'external' {
  return value === 'external' ? 'external' : 'none';
}

function normalizeBackupSchedule(value: FormDataEntryValue | null): 'daily' | 'weekly' | 'monthly' | 'custom' | null {
  switch (value) {
    case 'daily':
    case 'weekly':
    case 'monthly':
    case 'custom':
      return value;
    default:
      return null;
  }
}

function normalizeRecoveryCheckStatus(value: FormDataEntryValue | null): 'succeeded' | 'failed' {
  return value === 'failed' ? 'failed' : 'succeeded';
}

function normalizeRestoreRequestStatus(
  value: FormDataEntryValue | null
): 'requested' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled' {
  switch (value) {
    case 'in_progress':
    case 'succeeded':
    case 'failed':
    case 'cancelled':
      return value;
    case 'requested':
    default:
      return 'requested';
  }
}

function normalizeRestoreRequestApprovalStatus(
  value: FormDataEntryValue | null
): 'approved' | 'rejected' {
  return value === 'rejected' ? 'rejected' : 'approved';
}

function normalizeBackupArtifactLifecycleStatus(
  value: FormDataEntryValue | null
): 'active' | 'archived' | 'purged' {
  switch (value) {
    case 'archived':
    case 'purged':
      return value;
    case 'active':
    default:
      return 'active';
  }
}

function normalizeOptionalIsoDate(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeOptionalSizeBytes(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const sizeMb = Number(normalized);
  if (!Number.isFinite(sizeMb) || sizeMb <= 0) {
    return null;
  }

  return Math.round(sizeMb * 1024 * 1024);
}

function createProjectDatabaseActionErrorMessage(
  action:
    | 'create'
    | 'update-links'
    | 'reconcile'
    | 'rotate-credentials'
    | 'backup-policy'
    | 'recovery-check'
    | 'backup-artifact'
    | 'update-backup-artifact'
    | 'restore-request'
    | 'review-restore-request'
    | 'update-restore-request'
    | 'delete',
  error: unknown
) {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Managed database actions are unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to manage project databases for this project.';
  }

  if (statusCode === 404) {
    return action === 'create'
      ? 'That project is no longer available.'
      : 'That managed database no longer exists.';
  }

  if (statusCode === 409) {
    if (action === 'create') {
      return 'That managed database name is already in use for this project.';
    }

    if (action === 'rotate-credentials') {
      return 'Managed Postgres credentials can only be rotated after the database is fully provisioned with runtime connection details.';
    }

    if (action === 'recovery-check') {
      return 'Record an external backup runbook before tracking backup or restore verification for this managed database.';
    }

    if (action === 'backup-artifact') {
      return 'Document an external backup runbook before recording backup artifacts for this managed database.';
    }

    if (action === 'update-backup-artifact') {
      return 'That backup artifact can no longer be updated for this managed database.';
    }

    if (action === 'restore-request') {
      return 'Document an external backup runbook before creating restore requests for this managed database.';
    }

    if (action === 'review-restore-request' || action === 'update-restore-request') {
      return 'This restore request cannot move forward until the workflow state is consistent with approval and execution timing.';
    }

    return 'That managed database action conflicts with the current resource state.';
  }

  if (statusCode === 400) {
    if (action === 'backup-policy') {
      return 'Document a valid external backup runbook before enabling external backup coverage.';
    }

    if (action === 'backup-artifact') {
      return 'Enter a valid artifact label, storage location, and produced-at time before recording a backup artifact.';
    }

    if (action === 'update-backup-artifact') {
      return 'Choose a valid artifact lifecycle, integrity state, and retention timestamp before saving this backup artifact.';
    }

    if (
      action === 'restore-request'
      || action === 'review-restore-request'
      || action === 'update-restore-request'
    ) {
      return 'Enter a valid restore target and request details before saving this restore workflow update.';
    }

    return 'Enter a valid managed database name and only choose services that belong to this project.';
  }

  if (statusCode === 503) {
    return action === 'delete'
      ? 'The managed Postgres resource could not be removed right now. Retry shortly.'
      : action === 'rotate-credentials'
        ? 'Managed Postgres credentials could not be rotated right now. Retry shortly and confirm the runtime health check is passing.'
        : action === 'recovery-check'
        ? 'The recovery check could not be recorded right now. Retry shortly.'
        : action === 'backup-artifact'
          ? 'The backup artifact could not be recorded right now. Retry shortly.'
        : action === 'update-backup-artifact'
          ? 'The backup artifact update could not be recorded right now. Retry shortly.'
        : action === 'review-restore-request'
          ? 'The restore approval update could not be recorded right now. Retry shortly.'
        : action === 'restore-request' || action === 'update-restore-request'
          ? 'The restore workflow update could not be recorded right now. Retry shortly.'
        : 'Managed Postgres provisioning is not available right now. Check API configuration and retry.';
  }

  switch (action) {
    case 'create':
      return 'Failed to create managed database.';
    case 'update-links':
      return 'Failed to update linked services for this managed database.';
    case 'reconcile':
      return 'Failed to retry managed database provisioning.';
    case 'rotate-credentials':
      return 'Failed to rotate managed database credentials.';
    case 'backup-policy':
      return 'Failed to save managed database backup coverage.';
    case 'recovery-check':
      return 'Failed to record the managed database recovery check.';
    case 'backup-artifact':
      return 'Failed to record the managed database backup artifact.';
    case 'update-backup-artifact':
      return 'Failed to update the managed database backup artifact.';
    case 'restore-request':
      return 'Failed to create the managed database restore request.';
    case 'review-restore-request':
      return 'Failed to review the managed database restore request.';
    case 'update-restore-request':
      return 'Failed to update the managed database restore request.';
    case 'delete':
    default:
      return 'Failed to delete managed database.';
  }
}

function revalidateDatabasePaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/databases`);
  revalidatePath('/projects');
}

export async function createProjectDatabaseAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+request`);
  }

  const name = typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : '';
  const serviceNames = normalizeServiceNames(formData);

  if (name.length === 0) {
    redirect(`${returnPath}?status=error&message=Enter+a+valid+managed+database+name`);
  }

  try {
    const database = await createProjectDatabase(projectIdValue, {
      name,
      serviceNames
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Created managed Postgres resource "${database.name}"`)}` 
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('create', error))}`);
  }
}

export async function updateProjectDatabaseServiceLinksAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+link+request`);
  }

  try {
    const database = await updateProjectDatabaseServiceLinks(projectIdValue, databaseIdValue, {
      serviceNames: normalizeServiceNames(formData)
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Updated linked services for "${database.name}"`)}` 
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('update-links', error))}`);
  }
}

export async function reconcileProjectDatabaseAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+retry+request`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';

  try {
    await reconcileProjectDatabase(projectIdValue, databaseIdValue);

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Retried provisioning for "${databaseLabel}"`)}` 
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('reconcile', error))}`);
  }
}

export async function rotateProjectDatabaseCredentialsAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+rotation+request`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';

  try {
    await rotateProjectDatabaseCredentials(projectIdValue, databaseIdValue);

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Rotated credentials for "${databaseLabel}". Redeploy linked services to pick up the new password.`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('rotate-credentials', error))}`);
  }
}

export async function updateProjectDatabaseBackupPolicyAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+backup+policy+request`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';
  const backupMode = normalizeBackupMode(formData.get('backupMode'));
  const backupSchedule = backupMode === 'external'
    ? normalizeBackupSchedule(formData.get('backupSchedule'))
    : null;
  const backupRunbook = typeof formData.get('backupRunbook') === 'string'
    ? String(formData.get('backupRunbook')).trim()
    : '';

  try {
    await updateProjectDatabaseBackupPolicy(projectIdValue, databaseIdValue, {
      backupMode,
      backupSchedule,
      backupRunbook
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Updated backup coverage for "${databaseLabel}"`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('backup-policy', error))}`);
  }
}

export async function recordProjectDatabaseRecoveryCheckAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));
  const kindValue = formData.get('kind');
  const statusValue = normalizeRecoveryCheckStatus(formData.get('status'));
  const summaryValue = typeof formData.get('summary') === 'string'
    ? String(formData.get('summary')).trim()
    : '';
  const detailValue = typeof formData.get('detail') === 'string'
    ? String(formData.get('detail')).trim()
    : '';

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
    || (kindValue !== 'backup' && kindValue !== 'restore')
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+recovery+check+request`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';

  try {
    await recordProjectDatabaseRecoveryCheck(projectIdValue, databaseIdValue, {
      kind: kindValue,
      status: statusValue,
      ...(summaryValue.length > 0 ? { summary: summaryValue } : {}),
      ...(detailValue.length > 0 ? { detail: detailValue } : {})
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(
        kindValue === 'backup'
          ? statusValue === 'failed'
            ? `Recorded failed backup run for "${databaseLabel}"`
            : `Recorded successful backup run for "${databaseLabel}"`
          : statusValue === 'failed'
            ? `Recorded failed restore drill for "${databaseLabel}"`
            : `Recorded successful restore drill for "${databaseLabel}"`
      )}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('recovery-check', error))}`);
  }
}

export async function recordProjectDatabaseBackupArtifactAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));
  const labelValue = typeof formData.get('label') === 'string' ? String(formData.get('label')).trim() : '';
  const storageProviderValue = formData.get('storageProvider');
  const locationValue = typeof formData.get('location') === 'string' ? String(formData.get('location')).trim() : '';
  const producedAtValue = normalizeOptionalIsoDate(formData.get('producedAt'));
  const retentionExpiresAtValue = normalizeOptionalIsoDate(formData.get('retentionExpiresAt'));
  const sizeBytesValue = normalizeOptionalSizeBytes(formData.get('sizeMb'));
  const detailValue = typeof formData.get('detail') === 'string' ? String(formData.get('detail')).trim() : '';
  const integrityStatusValue = formData.get('integrityStatus');

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
    || labelValue.length === 0
    || locationValue.length === 0
    || !producedAtValue
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+artifact+request`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';
  const storageProvider =
    storageProviderValue === 's3'
    || storageProviderValue === 'gcs'
    || storageProviderValue === 'azure'
    || storageProviderValue === 'local'
    || storageProviderValue === 'other'
      ? storageProviderValue
      : 'other';
  const integrityStatus =
    integrityStatusValue === 'verified' || integrityStatusValue === 'failed'
      ? integrityStatusValue
      : 'unknown';

  try {
    await recordProjectDatabaseBackupArtifact(projectIdValue, databaseIdValue, {
      label: labelValue,
      storageProvider,
      location: locationValue,
      ...(sizeBytesValue !== null ? { sizeBytes: sizeBytesValue } : {}),
      producedAt: producedAtValue,
      ...(retentionExpiresAtValue ? { retentionExpiresAt: retentionExpiresAtValue } : {}),
      integrityStatus,
      ...(detailValue.length > 0 ? { detail: detailValue } : {})
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Recorded backup artifact for "${databaseLabel}"`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('backup-artifact', error))}`);
  }
}

export async function updateProjectDatabaseBackupArtifactAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const backupArtifactIdValue = formData.get('backupArtifactId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));
  const integrityStatusValue = formData.get('integrityStatus');
  const lifecycleStatusValue = formData.get('lifecycleStatus');
  const retentionExpiresAtValue = normalizeOptionalIsoDate(formData.get('retentionExpiresAt'));
  const detailValue = typeof formData.get('detail') === 'string' ? String(formData.get('detail')).trim() : '';

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
    || typeof backupArtifactIdValue !== 'string'
    || backupArtifactIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+artifact+update`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';
  const integrityStatus =
    integrityStatusValue === 'verified' || integrityStatusValue === 'failed'
      ? integrityStatusValue
      : 'unknown';
  const lifecycleStatus = normalizeBackupArtifactLifecycleStatus(lifecycleStatusValue);

  try {
    await updateProjectDatabaseBackupArtifact(projectIdValue, databaseIdValue, backupArtifactIdValue, {
      integrityStatus,
      lifecycleStatus,
      ...(retentionExpiresAtValue ? { retentionExpiresAt: retentionExpiresAtValue } : {}),
      ...(detailValue.length > 0 ? { detail: detailValue } : {})
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Updated backup artifact controls for "${databaseLabel}"`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('update-backup-artifact', error))}`);
  }
}

export async function createProjectDatabaseRestoreRequestAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));
  const backupArtifactIdValue = formData.get('backupArtifactId');
  const targetValue = typeof formData.get('target') === 'string' ? String(formData.get('target')).trim() : '';
  const summaryValue = typeof formData.get('summary') === 'string' ? String(formData.get('summary')).trim() : '';
  const detailValue = typeof formData.get('detail') === 'string' ? String(formData.get('detail')).trim() : '';

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
    || targetValue.length === 0
    || summaryValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+restore+request`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';
  const backupArtifactId =
    typeof backupArtifactIdValue === 'string' && backupArtifactIdValue.trim().length > 0
      ? backupArtifactIdValue.trim()
      : null;

  try {
    await createProjectDatabaseRestoreRequest(projectIdValue, databaseIdValue, {
      ...(backupArtifactId ? { backupArtifactId } : {}),
      target: targetValue,
      summary: summaryValue,
      ...(detailValue.length > 0 ? { detail: detailValue } : {})
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Created restore request for "${databaseLabel}"`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('restore-request', error))}`);
  }
}

export async function reviewProjectDatabaseRestoreRequestAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const restoreRequestIdValue = formData.get('restoreRequestId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));
  const approvalStatusValue = normalizeRestoreRequestApprovalStatus(formData.get('approvalStatus'));
  const approvalDetailValue =
    typeof formData.get('approvalDetail') === 'string' ? String(formData.get('approvalDetail')).trim() : '';

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
    || typeof restoreRequestIdValue !== 'string'
    || restoreRequestIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+restore+review`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';

  try {
    await reviewProjectDatabaseRestoreRequest(projectIdValue, databaseIdValue, restoreRequestIdValue, {
      approvalStatus: approvalStatusValue,
      ...(approvalDetailValue.length > 0 ? { approvalDetail: approvalDetailValue } : {})
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Reviewed restore request for "${databaseLabel}"`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('review-restore-request', error))}`);
  }
}

export async function updateProjectDatabaseRestoreRequestAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const restoreRequestIdValue = formData.get('restoreRequestId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));
  const statusValue = normalizeRestoreRequestStatus(formData.get('status'));
  const detailValue = typeof formData.get('detail') === 'string' ? String(formData.get('detail')).trim() : '';

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
    || typeof restoreRequestIdValue !== 'string'
    || restoreRequestIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+restore+update`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';

  try {
    await updateProjectDatabaseRestoreRequest(projectIdValue, databaseIdValue, restoreRequestIdValue, {
      status: statusValue,
      ...(detailValue.length > 0 ? { detail: detailValue } : {})
    });

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Updated restore workflow for "${databaseLabel}"`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('update-restore-request', error))}`);
  }
}

export async function removeProjectDatabaseAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const databaseIdValue = formData.get('databaseId');
  const databaseNameValue = formData.get('databaseName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Managed database management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof databaseIdValue !== 'string'
    || databaseIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+managed+database+delete+request`);
  }

  const databaseLabel =
    typeof databaseNameValue === 'string' && databaseNameValue.trim().length > 0
      ? databaseNameValue.trim()
      : 'managed database';

  try {
    await removeProjectDatabase(projectIdValue, databaseIdValue);

    revalidateDatabasePaths(projectIdValue);
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Deleted "${databaseLabel}"`)}` 
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDatabaseActionErrorMessage('delete', error))}`);
  }
}
