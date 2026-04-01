import { fetchJson, postJson, deleteRequest } from './client';
import type { ApiDataResponse, ApiProjectDomain } from './types';

interface FetchProjectDomainsOptions {
  includeDiagnostics?: boolean;
}

export async function fetchProjectDomains(
  projectId: string,
  options: FetchProjectDomainsOptions = {}
): Promise<ApiProjectDomain[]> {
  const query = new URLSearchParams();
  if (options.includeDiagnostics) {
    query.set('includeDiagnostics', 'true');
  }

  const response = await fetchJson<ApiDataResponse<ApiProjectDomain[]>>(
    `/v1/projects/${projectId}/domains${query.size > 0 ? `?${query.toString()}` : ''}`
  );

  return response.data;
}

export async function createProjectDomain(
  projectId: string,
  input: {
    host: string;
  }
): Promise<ApiProjectDomain> {
  const response = await postJson<ApiDataResponse<ApiProjectDomain>>(
    `/v1/projects/${projectId}/domains`,
    {
      host: input.host
    }
  );

  return response.data;
}

export async function removeProjectDomain(projectId: string, domainId: string): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/domains/${domainId}`);
}

export async function verifyProjectDomain(
  projectId: string,
  domainId: string
): Promise<ApiProjectDomain> {
  const response = await postJson<ApiDataResponse<ApiProjectDomain>>(
    `/v1/projects/${projectId}/domains/${domainId}/verify`,
    {}
  );

  return response.data;
}
