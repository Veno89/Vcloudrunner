import { fetchJson, postJson, putJson, deleteRequest, requestApi } from './client';
import type {
  ApiDataResponse,
  ApiProjectInvitation,
  ApiProjectInvitationClaim,
  ApiProjectInviteResult,
  ApiProjectInvitationRedeliveryResult
} from './types';

export async function fetchProjectInvitations(projectId: string): Promise<ApiProjectInvitation[]> {
  const response = await fetchJson<ApiDataResponse<ApiProjectInvitation[]>>(
    `/v1/projects/${projectId}/invitations`
  );

  return response.data;
}

export async function fetchProjectInvitationClaim(
  claimToken: string
): Promise<ApiProjectInvitationClaim | null> {
  const response = await requestApi(`/v1/project-invitations/claim/${encodeURIComponent(claimToken)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  const payload = await response.json() as ApiDataResponse<ApiProjectInvitationClaim>;
  return payload.data;
}

export async function inviteProjectMember(
  projectId: string,
  input: {
    email: string;
    role: 'viewer' | 'editor' | 'admin';
  }
): Promise<ApiProjectInviteResult> {
  const response = await postJson<ApiDataResponse<ApiProjectInviteResult>>(
    `/v1/projects/${projectId}/members`,
    {
      email: input.email,
      role: input.role
    }
  );

  return response.data;
}

export async function updateProjectInvitation(
  projectId: string,
  invitationId: string,
  input: {
    role: 'viewer' | 'editor' | 'admin';
  }
): Promise<ApiProjectInvitation> {
  const response = await putJson<ApiDataResponse<ApiProjectInvitation>>(
    `/v1/projects/${projectId}/invitations/${invitationId}`,
    {
      role: input.role
    }
  );

  return response.data;
}

export async function removeProjectInvitation(
  projectId: string,
  invitationId: string
): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/invitations/${invitationId}`);
}

export async function redeliverProjectInvitation(
  projectId: string,
  invitationId: string
): Promise<ApiProjectInvitationRedeliveryResult> {
  const response = await postJson<ApiDataResponse<ApiProjectInvitationRedeliveryResult>>(
    `/v1/projects/${projectId}/invitations/${invitationId}/redeliver`,
    {}
  );

  return response.data;
}

export async function acceptProjectInvitationClaim(
  claimToken: string
): Promise<ApiProjectInvitationClaim> {
  const response = await postJson<ApiDataResponse<ApiProjectInvitationClaim>>(
    `/v1/project-invitations/claim/${encodeURIComponent(claimToken)}/accept`,
    {}
  );

  return response.data;
}
