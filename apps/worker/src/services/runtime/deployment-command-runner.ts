export interface DeploymentCommandRunner {
  cloneRepository(input: {
    gitRepositoryUrl: string;
    branch: string;
    repoDir: string;
  }): Promise<void>;
  buildImage(input: {
    dockerfilePath: string;
    buildContextPath: string;
    imageTag: string;
    repoDir: string;
  }): Promise<void>;
  removeImage(imageTag: string): Promise<void>;
}
