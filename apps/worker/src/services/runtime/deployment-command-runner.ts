export interface DeploymentCommandRunner {
  cloneRepository(input: {
    gitRepositoryUrl: string;
    branch: string;
    repoDir: string;
  }): Promise<void>;
  buildImage(input: {
    dockerfilePath: string;
    imageTag: string;
    repoDir: string;
  }): Promise<void>;
  removeImage(imageTag: string): Promise<void>;
}
