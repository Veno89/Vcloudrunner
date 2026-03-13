export type DeploymentStatus = 'queued' | 'building' | 'running' | 'failed' | 'stopped';

export interface ProjectDto {
  id: string;
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

export const QUEUE_NAMES = {
  deployment: 'deployment-jobs'
} as const;

export interface DeploymentRuntimeConfig {
  containerPort: number;
  memoryMb: number;
  cpuMillicores: number;
}

export interface DeploymentJobPayload {
  deploymentId: string;
  projectId: string;
  projectSlug: string;
  correlationId?: string;
  gitRepositoryUrl: string;
  branch: string;
  commitSha?: string;
  env: Record<string, string>;
  runtime: DeploymentRuntimeConfig;
}
