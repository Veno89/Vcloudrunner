'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createProject, createDeployment, demoUserId } from '@/lib/api';
import {
  slugifyProjectName,
  extractApiStatusCode,
  createProjectErrorReason,
  createDeploymentErrorMessage,
  normalizeProjectDisplayName
} from '@/lib/helpers';

export async function createProjectAction(formData: FormData) {
  if (!demoUserId) {
    redirect('/projects?status=error&reason=user_context_missing');
    return;
  }

  const nameValue = formData.get('name');
  const gitRepositoryUrlValue = formData.get('gitRepositoryUrl');
  const defaultBranchValue = formData.get('defaultBranch');

  if (typeof nameValue !== 'string' || typeof gitRepositoryUrlValue !== 'string') {
    redirect('/projects?status=error&reason=invalid_input');
    return;
  }

  const name = nameValue.trim();
  const gitRepositoryUrl = gitRepositoryUrlValue.trim();
  const defaultBranch = typeof defaultBranchValue === 'string' ? defaultBranchValue.trim() : '';
  const slug = slugifyProjectName(name);

  if (name.length < 3 || slug.length < 3 || gitRepositoryUrl.length === 0) {
    redirect('/projects?status=error&reason=invalid_input');
    return;
  }

  try {
    await createProject({
      userId: demoUserId,
      name,
      slug,
      gitRepositoryUrl,
      defaultBranch: defaultBranch.length > 0 ? defaultBranch : undefined,
    });

    revalidatePath('/projects');
    redirect(`/projects?status=success&message=${encodeURIComponent(`Project "${name}" created`)}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const reason = createProjectErrorReason(statusCode);
    redirect(`/projects?status=error&reason=${reason}`);
  }
}

export async function triggerDeploymentAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const projectNameValue = formData.get('projectName');

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect('/projects?status=error&message=Deploy+failed');
    return;
  }

  const projectId = projectIdValue;
  const projectName = normalizeProjectDisplayName(projectNameValue);

  try {
    const deployment = await createDeployment(projectId);
    revalidatePath('/projects');
    revalidatePath('/deployments');
    redirect(`/deployments/${deployment.id}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, projectName);
    redirect(`/projects?status=error&message=${encodeURIComponent(message)}`);
  }
}
