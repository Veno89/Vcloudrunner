import { fetchJson, postJson, putJson, deleteRequest, requestApi, buildDashboardAuthHeaders } from './client';
import type { ApiDataResponse, ApiEnvironmentVariable } from './types';

export async function fetchEnvironmentVariables(projectId: string): Promise<ApiEnvironmentVariable[]> {
  const response = await fetchJson<ApiDataResponse<ApiEnvironmentVariable[]>>(
    `/v1/projects/${projectId}/environment-variables`
  );

  return response.data;
}

export async function upsertEnvironmentVariable(
  projectId: string,
  key: string,
  value: string
): Promise<ApiEnvironmentVariable> {
  const response = await putJson<ApiDataResponse<ApiEnvironmentVariable>>(
    `/v1/projects/${projectId}/environment-variables`,
    { key, value }
  );

  return response.data;
}

export async function deleteEnvironmentVariable(projectId: string, key: string): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/environment-variables/${encodeURIComponent(key)}`);
}

export async function exportEnvironmentVariables(projectId: string): Promise<string> {
  const response = await requestApi(
    `/v1/projects/${projectId}/environment-variables/export`,
    {
      headers: buildDashboardAuthHeaders()
    }
  );

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.text();
}

export async function importEnvironmentVariables(
  projectId: string,
  content: string
): Promise<{ imported: number; skipped: number }> {
  const response = await postJson<ApiDataResponse<{ imported: number; skipped: number }>>(
    `/v1/projects/${projectId}/environment-variables/import`,
    { content }
  );

  return response.data;
}
