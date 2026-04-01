import { fetchJson, putJson, deleteRequest, postJson } from './client';
import type { ApiDataResponse, ApiProjectMember } from './types';

export async function fetchProjectMembers(projectId: string): Promise<ApiProjectMember[]> {
  const response = await fetchJson<ApiDataResponse<ApiProjectMember[]>>(
    `/v1/projects/${projectId}/members`
  );

  return response.data;
}

export async function updateProjectMemberRole(
  projectId: string,
  memberUserId: string,
  input: {
    role: 'viewer' | 'editor' | 'admin';
  }
): Promise<ApiProjectMember> {
  const response = await putJson<ApiDataResponse<ApiProjectMember>>(
    `/v1/projects/${projectId}/members/${memberUserId}`,
    {
      role: input.role
    }
  );

  return response.data;
}

export async function removeProjectMember(
  projectId: string,
  memberUserId: string
): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/members/${memberUserId}`);
}

export async function transferProjectOwnership(
  projectId: string,
  memberUserId: string
): Promise<ApiProjectMember> {
  const response = await postJson<ApiDataResponse<ApiProjectMember>>(
    `/v1/projects/${projectId}/ownership`,
    {
      userId: memberUserId
    }
  );

  return response.data;
}
