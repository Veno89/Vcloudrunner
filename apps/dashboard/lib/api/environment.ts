import { fetchJson, putJson, deleteRequest } from './client';
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
