import type { ProjectServiceDefinition } from '@vcloudrunner/shared-types';

import { fetchJson, postJson, patchJson, deleteRequest } from './client';
import { fetchViewerContext } from './auth';
import type { ApiDataResponse, ApiProject } from './types';

interface CreateProjectInput {
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch?: string;
  services?: ProjectServiceDefinition[];
  githubInstallationId?: number;
}

interface UpdateProjectInput {
  name?: string;
  gitRepositoryUrl?: string;
  defaultBranch?: string;
  services?: ProjectServiceDefinition[];
}

export async function fetchProjectsForCurrentUser(): Promise<ApiProject[]> {
  const viewer = await fetchViewerContext();
  if (!viewer) {
    return [];
  }

  const response = await fetchJson<ApiDataResponse<ApiProject[]>>(
    `/v1/users/${viewer.userId}/projects`
  );

  return response.data;
}

export async function createProject(input: CreateProjectInput): Promise<ApiProject> {
  const response = await postJson<ApiDataResponse<ApiProject>>('/v1/projects', { ...input });

  return response.data;
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<ApiProject> {
  const response = await patchJson<ApiDataResponse<ApiProject>>(
    `/v1/projects/${projectId}`,
    { ...input }
  );

  return response.data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}`);
}
