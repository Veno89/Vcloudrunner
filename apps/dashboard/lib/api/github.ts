import { fetchJson, postJson, deleteRequest } from './client';
import type { ApiDataResponse } from './types';

export interface GitHubInstallation {
  id: string;
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
}

export interface GitHubRepository {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
}

export async function fetchGitHubStatus(): Promise<{ configured: boolean }> {
  const response = await fetchJson<ApiDataResponse<{ configured: boolean }>>('/v1/github/status');
  return response.data;
}

export async function fetchGitHubInstallUrl(): Promise<string> {
  const response = await fetchJson<ApiDataResponse<{ url: string }>>('/v1/github/install-url');
  return response.data.url;
}

export async function registerGitHubInstallation(installationId: number): Promise<GitHubInstallation> {
  const response = await postJson<ApiDataResponse<GitHubInstallation>>(
    '/v1/github/installations/callback',
    { installationId }
  );
  return response.data;
}

export async function fetchGitHubInstallations(): Promise<GitHubInstallation[]> {
  const response = await fetchJson<ApiDataResponse<GitHubInstallation[]>>('/v1/github/installations');
  return response.data;
}

export async function fetchInstallationRepos(installationId: number): Promise<GitHubRepository[]> {
  const response = await fetchJson<ApiDataResponse<GitHubRepository[]>>(
    `/v1/github/installations/${installationId}/repos`
  );
  return response.data;
}

export async function removeGitHubInstallation(installationId: number): Promise<void> {
  await deleteRequest(`/v1/github/installations/${installationId}`);
}
