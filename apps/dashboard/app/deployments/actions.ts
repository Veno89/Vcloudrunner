'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createDeployment } from '@/lib/api';
import {
  createDeploymentErrorMessage,
  extractApiStatusCode,
  normalizeProjectDisplayName
} from '@/lib/helpers';

export async function deployProjectAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const projectNameValue = formData.get('projectName');

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect('/projects?status=error&message=Deploy+failed');
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
    redirect(`/projects?status=error&message=${encodeURIComponent(message)}`);
  }
}
