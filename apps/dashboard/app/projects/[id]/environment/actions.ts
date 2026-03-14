'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { upsertEnvironmentVariable, deleteEnvironmentVariable } from '@/lib/api';

export async function saveProjectEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');
  const valueValue = formData.get('value');

  if (
    typeof projectIdValue !== 'string' ||
    typeof keyValue !== 'string' ||
    typeof valueValue !== 'string'
  ) {
    redirect('/projects?status=error&message=Invalid+input');
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
  } catch {
    redirect(
      `/projects/${projectIdValue}/environment?status=error&message=Failed+to+save+variable`
    );
  }
}

export async function removeProjectEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');

  if (typeof projectIdValue !== 'string' || typeof keyValue !== 'string') {
    redirect('/projects?status=error&message=Invalid+input');
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
  } catch {
    redirect(
      `/projects/${projectIdValue}/environment?status=error&message=Failed+to+delete+variable`
    );
  }
}
