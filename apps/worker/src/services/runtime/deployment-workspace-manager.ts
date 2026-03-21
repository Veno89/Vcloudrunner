export interface PreparedDeploymentWorkspace {
  workspaceDir: string;
  repoDir: string;
  projectPath: string;
}

export interface DeploymentWorkspaceManager {
  prepareWorkspace(deploymentId: string): Promise<PreparedDeploymentWorkspace>;
  cleanupWorkspace(workspaceDir: string): Promise<void>;
}
