'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { upsertEnvironmentVariable, deleteEnvironmentVariable } from '@/lib/api';

export async function saveEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');
  const valueValue = formData.get('value');

  if (
    typeof projectIdValue !== 'string' ||
    typeof keyValue !== 'string' ||
    typeof valueValue !== 'string'
  ) {
    redirect('/environment?status=error&message=Invalid+input');
    return;
  }

  try {
    await upsertEnvironmentVariable(projectIdValue, keyValue, valueValue);
    revalidatePath('/environment');
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=success&message=${encodeURIComponent(`Variable "${keyValue}" saved`)}`
    );
  } catch {
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=error&message=Failed+to+save+variable`
    );
  }
}

export async function removeEnvironmentVariableAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');

  if (typeof projectIdValue !== 'string' || typeof keyValue !== 'string') {
    redirect('/environment?status=error&message=Invalid+input');
    return;
  }

  try {
    await deleteEnvironmentVariable(projectIdValue, keyValue);
    revalidatePath('/environment');
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=success&message=${encodeURIComponent(`Variable "${keyValue}" deleted`)}`
    );
  } catch {
    redirect(
      `/environment?envProjectId=${encodeURIComponent(projectIdValue)}&status=error&message=Failed+to+delete+variable`
    );
  }
}
