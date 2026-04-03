'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createDeployment, deployAllServices, redeployDeployment, rollbackToDeployment, cancelDeployment } from '@/lib/api';
import {
  createDeploymentErrorMessage,
  extractApiStatusCode,
  normalizeProjectDisplayName
} from '@/lib/helpers';

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

function appendQuery(path: string, params: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${params}`;
}

export async function deployProjectAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const projectNameValue = formData.get('projectName');
  const serviceNameValue = formData.get('serviceName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(appendQuery(returnPath, 'status=error&message=Invalid+deployment+request'));
    return;
  }

  const projectName = normalizeProjectDisplayName(projectNameValue);
  const serviceName =
    typeof serviceNameValue === 'string' && serviceNameValue.trim().length > 0
      ? serviceNameValue.trim()
      : undefined;

  let redirectTo: string | undefined;

  try {
    const deployment = await createDeployment(projectIdValue, {
      ...(serviceName ? { serviceName } : {})
    });
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath(`/projects/${projectIdValue}/deployments`);
    revalidatePath('/deployments');
    redirectTo = `/deployments/${deployment.id}`;
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, projectName);
    redirectTo = appendQuery(returnPath, `status=error&message=${encodeURIComponent(message)}`);
  }

  redirect(redirectTo);
}

export async function deployAllServicesAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(appendQuery(returnPath, 'status=error&message=Invalid+deployment+request'));
    return;
  }

  let redirectTo: string | undefined;

  try {
    const results = await deployAllServices(projectIdValue);
    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    revalidatePath('/projects');
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath(`/projects/${projectIdValue}/deployments`);
    revalidatePath('/deployments');

    const message = `Deployed ${created} service${created !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped (already active)` : ''}`;
    redirectTo = appendQuery(returnPath, `status=success&message=${encodeURIComponent(message)}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, 'all services');
    redirectTo = appendQuery(returnPath, `status=error&message=${encodeURIComponent(message)}`);
  }

  redirect(redirectTo);
}

export async function redeployAction(formData: FormData) {
  const projectId = formData.get('projectId');
  const deploymentId = formData.get('deploymentId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectId !== 'string' || typeof deploymentId !== 'string') {
    redirect(appendQuery(returnPath, 'status=error&message=Invalid+redeploy+request'));
    return;
  }

  let redirectTo: string | undefined;

  try {
    const deployment = await redeployDeployment(projectId, deploymentId);
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/deployments`);
    revalidatePath('/deployments');
    redirectTo = `/deployments/${deployment.id}`;
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, 'redeploy');
    redirectTo = appendQuery(returnPath, `status=error&message=${encodeURIComponent(message)}`);
  }

  redirect(redirectTo);
}

export async function rollbackAction(formData: FormData) {
  const projectId = formData.get('projectId');
  const deploymentId = formData.get('deploymentId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectId !== 'string' || typeof deploymentId !== 'string') {
    redirect(appendQuery(returnPath, 'status=error&message=Invalid+rollback+request'));
    return;
  }

  let redirectTo: string | undefined;

  try {
    const deployment = await rollbackToDeployment(projectId, deploymentId);
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/deployments`);
    revalidatePath('/deployments');
    redirectTo = `/deployments/${deployment.id}?status=success&message=${encodeURIComponent('Rollback deployment created')}`;
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, 'rollback');
    redirectTo = appendQuery(returnPath, `status=error&message=${encodeURIComponent(message)}`);
  }

  redirect(redirectTo);
}

export async function cancelDeploymentAction(formData: FormData) {
  const projectId = formData.get('projectId');
  const deploymentId = formData.get('deploymentId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectId !== 'string' || typeof deploymentId !== 'string') {
    redirect(appendQuery(returnPath, 'status=error&message=Invalid+cancel+request'));
    return;
  }

  let redirectTo: string | undefined;

  try {
    await cancelDeployment(projectId, deploymentId);
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/deployments`);
    revalidatePath('/deployments');
    redirectTo = `/deployments/${deploymentId}?status=success&message=${encodeURIComponent('Deployment stopped')}`;
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, 'cancel');
    redirectTo = appendQuery(returnPath, `status=error&message=${encodeURIComponent(message)}`);
  }

  redirect(redirectTo);
}
