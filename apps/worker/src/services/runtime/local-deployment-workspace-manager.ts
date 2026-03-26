import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { env } from '../../config/env.js';
import { resolveDeploymentProjectPath } from '../deployment-source-root.js';
import type {
  DeploymentWorkspaceManager,
  PrepareDeploymentWorkspaceOptions,
  PreparedDeploymentWorkspace
} from './deployment-workspace-manager.js';

export class LocalDeploymentWorkspaceManager implements DeploymentWorkspaceManager {
  constructor(private readonly workDir = env.WORK_DIR) {}

  async prepareWorkspace(
    deploymentId: string,
    options: PrepareDeploymentWorkspaceOptions = {}
  ): Promise<PreparedDeploymentWorkspace> {
    const workspaceDir = join(this.workDir, deploymentId);
    const repoDir = join(workspaceDir, 'repo');

    await rm(workspaceDir, { recursive: true, force: true });
    await mkdir(workspaceDir, { recursive: true });

    return {
      workspaceDir,
      repoDir,
      projectPath: resolveDeploymentProjectPath(repoDir, options.sourceRoot)
    };
  }

  async cleanupWorkspace(workspaceDir: string): Promise<void> {
    await rm(workspaceDir, { recursive: true, force: true });
  }
}
