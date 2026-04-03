import { logger } from '../../logger/logger.js';
import { normalizeDeploymentSourceRoot } from '../deployment-source-root.js';
import type { BuildSystemResolver } from '../build-detection/build-system-resolver.js';
import type { DeploymentCommandRunner } from './deployment-command-runner.js';
import type { BuildRuntimeImageInput, DeploymentImageBuilder, PreparedRuntimeImage } from './deployment-image-builder.js';
import { getMissingBuildFileError } from './deployment-image-builder.js';

export class ConfiguredDeploymentImageBuilder implements DeploymentImageBuilder {
  constructor(
    private readonly commandRunner: DeploymentCommandRunner,
    private readonly buildSystemResolver: BuildSystemResolver
  ) {}

  async buildRuntimeImage(input: BuildRuntimeImageInput): Promise<PreparedRuntimeImage> {
    const sourceRoot = normalizeDeploymentSourceRoot(input.sourceRoot);

    logger.info('cloning repository', { deploymentId: input.deploymentId });
    await this.commandRunner.cloneRepository({
      gitRepositoryUrl: input.gitRepositoryUrl,
      branch: input.branch,
      repoDir: input.repoDir,
      gitAccessToken: input.gitAccessToken
    });

    const buildResult = await this.buildSystemResolver.detect(input.repoDir, { sourceRoot });
    if (!buildResult) {
      throw getMissingBuildFileError(sourceRoot);
    }

    logger.info('building docker image', {
      imageTag: input.imageTag,
      dockerfilePath: buildResult.buildFilePath,
      buildContextPath: buildResult.buildContextPath
    });
    await this.commandRunner.buildImage({
      dockerfilePath: buildResult.buildFilePath,
      buildContextPath: buildResult.buildContextPath,
      imageTag: input.imageTag,
      repoDir: input.repoDir
    });

    return {
      buildFilePath: buildResult.buildFilePath,
      buildContextPath: buildResult.buildContextPath
    };
  }

  async removeImage(imageTag: string): Promise<void> {
    await this.commandRunner.removeImage(imageTag);
  }
}
