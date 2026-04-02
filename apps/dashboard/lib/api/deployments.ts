import { fetchJson, postJson } from './client';
import type { ApiDataResponse, ApiDeployment, ApiDeploymentLog } from './types';

interface CreateDeploymentInput {
  serviceName?: string;
}

export async function fetchDeploymentsForProject(projectId: string): Promise<ApiDeployment[]> {
  const response = await fetchJson<ApiDataResponse<ApiDeployment[]>>(
    `/v1/projects/${projectId}/deployments`
  );

  return response.data;
}

export async function createDeployment(
  projectId: string,
  input: CreateDeploymentInput = {}
): Promise<ApiDeployment> {
  const response = await postJson<ApiDataResponse<ApiDeployment>>(
    `/v1/projects/${projectId}/deployments`,
    {
      ...(input.serviceName ? { serviceName: input.serviceName } : {})
    }
  );

  return response.data;
}

interface DeployAllResult {
  serviceName: string;
  status: 'created' | 'skipped';
  deployment?: ApiDeployment;
  reason?: string;
}

export async function deployAllServices(projectId: string): Promise<DeployAllResult[]> {
  const response = await postJson<ApiDataResponse<DeployAllResult[]>>(
    `/v1/projects/${projectId}/deployments/all`,
    {}
  );

  return response.data;
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
