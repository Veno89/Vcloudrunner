import { DeploymentFailure } from '../../workers/deployment-errors.js';
import {
  ROOT_DEPLOYMENT_SOURCE_ROOT,
  normalizeDeploymentSourceRoot
} from '../deployment-source-root.js';

export interface PreparedRuntimeImage {
  buildFilePath: string;
  buildContextPath: string;
}

export interface BuildRuntimeImageInput {
  deploymentId: string;
  gitRepositoryUrl: string;
  branch: string;
  repoDir: string;
  imageTag: string;
  sourceRoot?: string | null;
  gitAccessToken?: string;
}

export interface DeploymentImageBuilder {
  buildRuntimeImage(input: BuildRuntimeImageInput): Promise<PreparedRuntimeImage>;
  removeImage(imageTag: string): Promise<void>;
}

export function getMissingBuildFileError(sourceRoot?: string | null) {
  const normalizedSourceRoot = normalizeDeploymentSourceRoot(sourceRoot);
  const scope =
    normalizedSourceRoot === ROOT_DEPLOYMENT_SOURCE_ROOT
      ? 'repository root or common subpaths'
      : `selected service root "${normalizedSourceRoot}" or its common subpaths`;

  return new DeploymentFailure(
    'DEPLOYMENT_DOCKERFILE_NOT_FOUND',
    `DEPLOYMENT_DOCKERFILE_NOT_FOUND: no Dockerfile found in ${scope}`,
    false
  );
}
