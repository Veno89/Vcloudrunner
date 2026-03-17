'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createDeployment } from '@/lib/api';
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
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}status=error&message=Invalid+deployment+request`);
    return;
  }

  const projectName = normalizeProjectDisplayName(projectNameValue);

  try {
    const deployment = await createDeployment(projectIdValue);
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
