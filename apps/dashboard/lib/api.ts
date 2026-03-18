import type { DeploymentStatus } from '@vcloudrunner/shared-types';

export interface ApiProject {
  id: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch: string;
}

export interface ApiDeployment {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  commitSha: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  runtimeUrl?: string | null;
}

export interface ApiQueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  prioritized: number;
}

export interface ApiQueueHealth {
  status: 'ok' | 'degraded' | 'unavailable';
  redis?: string;
  queue?: string;
  counts?: ApiQueueCounts;
  sampledAt?: string;
  message?: string;
}

export interface ApiWorkerHealth {
  status: 'ok' | 'stale' | 'unavailable';
  heartbeatKey?: string;
  staleAfterMs?: number;
  ageMs?: number;
  timestamp?: string;
  service?: string;
  pid?: number | null;
  message?: string;
}

export interface ApiServiceHealth {
  status: 'ok' | 'unavailable';
  message?: string;
}

export interface ApiEnvironmentVariable {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface ApiDeploymentLog {
  id: string;
  deploymentId: string;
  level: string;
  message: string;
  timestamp: string;
}

export interface ApiTokenRecord {
  id: string;
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tokenPreview: string;
}

export interface CreatedApiTokenRecord {
  id: string;
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  token: string;
}

interface ApiDataResponse<T> {
  data: T;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
const apiAuthToken = process.env.API_AUTH_TOKEN;

function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers = extra ? { ...extra } : {};

  if (apiAuthToken) {
    headers.authorization = `Bearer ${apiAuthToken}`;
  }

  if (demoUserId) {
    headers['x-user-id'] = demoUserId;
  }

  return headers;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    headers: buildAuthHeaders()
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function putJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'PUT',
    headers: buildAuthHeaders({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function deleteRequest(path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    cache: 'no-store',
    headers: buildAuthHeaders()
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }
}

export async function fetchProjectsForDemoUser(): Promise<ApiProject[]> {
  if (!demoUserId) {
    return [];
  }

  const response = await fetchJson<ApiDataResponse<ApiProject[]>>(
    `/v1/users/${demoUserId}/projects`
  );

  return response.data;
}

export async function fetchDeploymentsForProject(projectId: string): Promise<ApiDeployment[]> {
  const response = await fetchJson<ApiDataResponse<ApiDeployment[]>>(
    `/v1/projects/${projectId}/deployments`
  );

  return response.data;
}

export async function createDeployment(projectId: string): Promise<ApiDeployment> {
  const response = await postJson<ApiDataResponse<ApiDeployment>>(
    `/v1/projects/${projectId}/deployments`,
    {}
  );

  return response.data;
}

interface CreateProjectInput {
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch?: string;
}

export async function createProject(input: CreateProjectInput): Promise<ApiProject> {
  const response = await postJson<ApiDataResponse<ApiProject>>('/v1/projects', { ...input });

  return response.data;
}

interface CreateApiTokenInput {
  userId: string;
  role: 'admin' | 'user';
  scopes?: string[];
  label?: string;
  expiresAt?: string;
}

export async function fetchApiTokensForUser(userId: string): Promise<ApiTokenRecord[]> {
  const response = await fetchJson<ApiDataResponse<ApiTokenRecord[]>>(`/v1/users/${userId}/api-tokens`);

  return response.data;
}

export async function createApiToken(input: CreateApiTokenInput): Promise<CreatedApiTokenRecord> {
  const response = await postJson<ApiDataResponse<CreatedApiTokenRecord>>(`/v1/users/${input.userId}/api-tokens`, {
    role: input.role,
    ...(input.scopes && input.scopes.length > 0 ? { scopes: input.scopes } : {}),
    ...(input.label ? { label: input.label } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
  });

  return response.data;
}

export async function rotateApiToken(userId: string, tokenId: string): Promise<CreatedApiTokenRecord> {
  const response = await postJson<ApiDataResponse<CreatedApiTokenRecord>>(
    `/v1/users/${userId}/api-tokens/${tokenId}/rotate`,
    {}
  );

  return response.data;
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<void> {
  await deleteRequest(`/v1/users/${userId}/api-tokens/${tokenId}`);
}

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

export async function fetchDeploymentLogs(
  projectId: string,
  deploymentId: string,
  limit = 100
): Promise<ApiDeploymentLog[]> {
  const response = await fetchJson<ApiDataResponse<ApiDeploymentLog[]>>(
    `/v1/projects/${projectId}/deployments/${deploymentId}/logs?limit=${limit}`
  );

  return response.data;
}

export async function fetchQueueHealth(): Promise<ApiQueueHealth> {
  try {
    const response = await fetch(`${apiBaseUrl}/health/queue`, {
      cache: 'no-store',
      headers: buildAuthHeaders()
    });

    if (!response.ok) {
      const fallback = await response.json().catch(() => ({}));
      return {
        status: 'unavailable',
        message: typeof fallback?.message === 'string' ? fallback.message : `API_REQUEST_FAILED ${response.status}`
      };
    }

    return response.json() as Promise<ApiQueueHealth>;
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function fetchWorkerHealth(): Promise<ApiWorkerHealth> {
  try {
    const response = await fetch(`${apiBaseUrl}/health/worker`, {
      cache: 'no-store',
      headers: buildAuthHeaders()
    });

    if (!response.ok) {
      const fallback = await response.json().catch(() => ({}));
      return {
        status: 'unavailable',
        message: typeof fallback?.message === 'string' ? fallback.message : `API_REQUEST_FAILED ${response.status}`
      };
    }

    return response.json() as Promise<ApiWorkerHealth>;
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function fetchApiHealth(): Promise<ApiServiceHealth> {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      const fallback = await response.json().catch(() => ({}));
      return {
        status: 'unavailable',
        message: typeof fallback?.message === 'string' ? fallback.message : `API_REQUEST_FAILED ${response.status}`
      };
    }

    const payload = await response.json().catch(() => ({} as { status?: string; message?: string }));
    return {
      status: payload.status === 'ok' ? 'ok' : 'unavailable',
      ...(typeof payload.message === 'string' ? { message: payload.message } : {})
    };
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export { apiBaseUrl, demoUserId, apiAuthToken };
