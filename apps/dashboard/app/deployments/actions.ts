'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createDeployment, deployAllServices } from '@/lib/api';
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

export async function deployProjectAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const projectNameValue = formData.get('projectName');
  const serviceNameValue = formData.get('serviceName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}status=error&message=Invalid+deployment+request`);
    return;
  }

  const projectName = normalizeProjectDisplayName(projectNameValue);
  const serviceName =
    typeof serviceNameValue === 'string' && serviceNameValue.trim().length > 0
      ? serviceNameValue.trim()
      : undefined;

  try {
    const deployment = await createDeployment(projectIdValue, {
      ...(serviceName ? { serviceName } : {})
    });
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath(`/projects/${projectIdValue}/deployments`);
    revalidatePath('/deployments');
    redirect(`/deployments/${deployment.id}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, projectName);
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function deployAllServicesAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}status=error&message=Invalid+deployment+request`);
    return;
  }

  try {
    const results = await deployAllServices(projectIdValue);
    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    revalidatePath('/projects');
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath(`/projects/${projectIdValue}/deployments`);
    revalidatePath('/deployments');

    const message = `Deployed ${created} service${created !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped (already active)` : ''}`;
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}status=success&message=${encodeURIComponent(message)}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, 'all services');
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}status=error&message=${encodeURIComponent(message)}`);
  }
}
