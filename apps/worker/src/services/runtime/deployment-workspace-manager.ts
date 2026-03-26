export interface PreparedDeploymentWorkspace {
  workspaceDir: string;
  repoDir: string;
  projectPath: string;
}

export interface PrepareDeploymentWorkspaceOptions {
  sourceRoot?: string | null;
}

export interface DeploymentWorkspaceManager {
  prepareWorkspace(
    deploymentId: string,
    options?: PrepareDeploymentWorkspaceOptions
  ): Promise<PreparedDeploymentWorkspace>;
  cleanupWorkspace(workspaceDir: string): Promise<void>;
}
