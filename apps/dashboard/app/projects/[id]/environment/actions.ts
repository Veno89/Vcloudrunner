'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { upsertEnvironmentVariable, deleteEnvironmentVariable } from '@/lib/api';
import { createEnvironmentVariableActionErrorMessage } from '@/lib/helpers';

function buildProjectEnvironmentRedirectPath(projectId: string | null | undefined): string {
  if (!projectId) {
    return '/projects';
  }

  return `/projects/${encodeURIComponent(projectId)}/environment`;
}

export async function saveProjectEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');
  const valueValue = formData.get('value');

  if (
    typeof projectIdValue !== 'string' ||
    typeof keyValue !== 'string' ||
    typeof valueValue !== 'string'
  ) {
    const basePath = buildProjectEnvironmentRedirectPath(typeof projectIdValue === 'string' ? projectIdValue : null);
    redirect(`${basePath}${basePath.includes('?') ? '&' : '?'}status=error&message=Invalid+input`);
    return;
  }

  try {
    await upsertEnvironmentVariable(projectIdValue, keyValue, valueValue);
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath(`/projects/${projectIdValue}/environment`);
    revalidatePath('/environment');
    redirect(
      `/projects/${projectIdValue}/environment?status=success&message=${encodeURIComponent(`Variable "${keyValue}" saved`)}`
    );
  } catch (error) {
    const message = createEnvironmentVariableActionErrorMessage('save', error);
    redirect(
      `/projects/${encodeURIComponent(projectIdValue)}/environment?status=error&message=${encodeURIComponent(message)}`
    );
  }
}

export async function removeProjectEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');

  if (typeof projectIdValue !== 'string' || typeof keyValue !== 'string') {
    const basePath = buildProjectEnvironmentRedirectPath(typeof projectIdValue === 'string' ? projectIdValue : null);
    redirect(`${basePath}${basePath.includes('?') ? '&' : '?'}status=error&message=Invalid+input`);
    return;
  }

  try {
    await deleteEnvironmentVariable(projectIdValue, keyValue);
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath(`/projects/${projectIdValue}/environment`);
    revalidatePath('/environment');
    redirect(
      `/projects/${projectIdValue}/environment?status=success&message=${encodeURIComponent(`Variable "${keyValue}" deleted`)}`
    );
  } catch (error) {
    const message = createEnvironmentVariableActionErrorMessage('delete', error);
    redirect(
      `/projects/${encodeURIComponent(projectIdValue)}/environment?status=error&message=${encodeURIComponent(message)}`
    );
  }
}
