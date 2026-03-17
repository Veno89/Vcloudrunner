'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { upsertEnvironmentVariable, deleteEnvironmentVariable } from '@/lib/api';
import { createEnvironmentVariableActionErrorMessage } from '@/lib/helpers';

function buildEnvironmentRedirectPath(projectId: string | null | undefined): string {
  if (!projectId) {
    return '/environment';
  }

  return `/environment?envProjectId=${encodeURIComponent(projectId)}`;
}

export async function saveEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');
  const valueValue = formData.get('value');

  if (
    typeof projectIdValue !== 'string' ||
    typeof keyValue !== 'string' ||
    typeof valueValue !== 'string'
  ) {
    const basePath = buildEnvironmentRedirectPath(typeof projectIdValue === 'string' ? projectIdValue : null);
    redirect(`${basePath}${basePath.includes('?') ? '&' : '?'}status=error&message=Invalid+input`);
    return;
  }

  try {
    await upsertEnvironmentVariable(projectIdValue, keyValue, valueValue);
    revalidatePath('/environment');
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=success&message=${encodeURIComponent(`Variable "${keyValue}" saved`)}`
    );
  } catch (error) {
    const message = createEnvironmentVariableActionErrorMessage('save', error);
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=error&message=${encodeURIComponent(message)}`
    );
  }
}

export async function removeEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');

  if (typeof projectIdValue !== 'string' || typeof keyValue !== 'string') {
    const basePath = buildEnvironmentRedirectPath(typeof projectIdValue === 'string' ? projectIdValue : null);
    redirect(`${basePath}${basePath.includes('?') ? '&' : '?'}status=error&message=Invalid+input`);
    return;
  }

  try {
    await deleteEnvironmentVariable(projectIdValue, keyValue);
    revalidatePath('/environment');
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=success&message=${encodeURIComponent(`Variable "${keyValue}" deleted`)}`
    );
  } catch (error) {
    const message = createEnvironmentVariableActionErrorMessage('delete', error);
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=error&message=${encodeURIComponent(message)}`
    );
  }
}
