import { DeploymentFailure } from '../../workers/deployment-errors.js';

export interface PreparedRuntimeImage {
  buildFilePath: string;
}

export interface BuildRuntimeImageInput {
  deploymentId: string;
  gitRepositoryUrl: string;
  branch: string;
  repoDir: string;
  imageTag: string;
}

export interface DeploymentImageBuilder {
  buildRuntimeImage(input: BuildRuntimeImageInput): Promise<PreparedRuntimeImage>;
  removeImage(imageTag: string): Promise<void>;
}

export function getMissingBuildFileError() {
  return new DeploymentFailure(
    'DEPLOYMENT_DOCKERFILE_NOT_FOUND',
    'DEPLOYMENT_DOCKERFILE_NOT_FOUND: no Dockerfile found in repository root or common subpaths',
    false
  );
}
