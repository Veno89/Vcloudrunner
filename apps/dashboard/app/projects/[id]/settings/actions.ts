'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ProjectServiceDefinition } from '@vcloudrunner/shared-types';
import { resolveViewerContext, updateProject } from '@/lib/api';

export async function updateProjectGeneralAction(formData: FormData) {
  const { viewer } = await resolveViewerContext();
  if (!viewer) {
    redirect('/');
  }

  const projectId = formData.get('projectId') as string;
  const name = formData.get('name') as string;
  const gitRepositoryUrl = formData.get('gitRepositoryUrl') as string;
  const defaultBranch = formData.get('defaultBranch') as string;

  try {
    await updateProject(projectId, {
      name: name || undefined,
      gitRepositoryUrl: gitRepositoryUrl || undefined,
      defaultBranch: defaultBranch || undefined,
    });

    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}/settings?status=success&message=${encodeURIComponent('Project settings updated')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update project settings';
    redirect(`/projects/${projectId}/settings?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function updateProjectServicesAction(formData: FormData) {
  const { viewer } = await resolveViewerContext();
  if (!viewer) {
    redirect('/');
  }

  const projectId = formData.get('projectId') as string;
  const servicesJson = formData.get('services') as string;

  let services: ProjectServiceDefinition[];
  try {
    services = JSON.parse(servicesJson);
  } catch {
    redirect(`/projects/${projectId}/settings?status=error&message=${encodeURIComponent('Invalid service configuration')}`);
    return;
  }

  try {
    await updateProject(projectId, { services });

    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}/settings?status=success&message=${encodeURIComponent('Services updated')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update services';
    redirect(`/projects/${projectId}/settings?status=error&message=${encodeURIComponent(message)}`);
  }
}
