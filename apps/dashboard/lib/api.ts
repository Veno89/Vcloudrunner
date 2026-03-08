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
  status: string;
  commitSha: string | null;
  createdAt: string;
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

interface ApiDataResponse<T> {
  data: T;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
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
    headers: {
      'content-type': 'application/json'
    },
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
    cache: 'no-store'
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

export { apiBaseUrl, demoUserId };
