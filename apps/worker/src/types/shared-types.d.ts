declare module '@vcloudrunner/shared-types' {
  export interface DeploymentRuntimeConfig {
    containerPort: number;
    memoryMb: number;
    cpuMillicores: number;
  }

  export interface DeploymentJobPayload {
    deploymentId: string;
    projectId: string;
    projectSlug: string;
    gitRepositoryUrl: string;
    branch: string;
    commitSha?: string;
    env: Record<string, string>;
    runtime: DeploymentRuntimeConfig;
  }

  export const QUEUE_NAMES: {
    deployment: string;
  };
}
