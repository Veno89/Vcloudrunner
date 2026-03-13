import type { DeploymentJobPayload } from '@vcloudrunner/shared-types';

export interface RuntimeExecutionResult {
  containerId: string;
  containerName: string;
  imageTag: string;
  hostPort: number | null;
  runtimeUrl: string | null;
  internalPort: number;
  projectPath: string;
}

export interface RuntimeExecutor {
  run(job: DeploymentJobPayload): Promise<RuntimeExecutionResult>;
  cleanupCancelledRun(input: { deploymentId: string; containerId: string; imageTag: string }): Promise<void>;
}