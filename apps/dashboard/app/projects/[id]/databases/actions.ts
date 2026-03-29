'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { createViewerContextFailureRedirect } from '@/lib/dashboard-action-auth';
import { buildDashboardAccountSetupHref } from '@/lib/dashboard-auth-navigation';
import {
  createProjectDatabase,
  reconcileProjectDatabase,
  removeProjectDatabase,
  rotateProjectDatabaseCredentials,
  resolveViewerContext,
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

function createProjectDatabaseActionErrorMessage(
  action: 'create' | 'update-links' | 'reconcile' | 'rotate-credentials' | 'delete',
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

    return 'That managed database action conflicts with the current resource state.';
  }

  if (statusCode === 400) {
    return 'Enter a valid managed database name and only choose services that belong to this project.';
  }

  if (statusCode === 503) {
    return action === 'delete'
      ? 'The managed Postgres resource could not be removed right now. Retry shortly.'
      : action === 'rotate-credentials'
        ? 'Managed Postgres credentials could not be rotated right now. Retry shortly and confirm the runtime health check is passing.'
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
