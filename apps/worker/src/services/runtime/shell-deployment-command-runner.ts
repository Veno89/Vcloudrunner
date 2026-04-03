import { execFileRunner, type ExecFileRunner } from '../process-exec-file-runner.js';
import type { DeploymentCommandRunner } from './deployment-command-runner.js';

function injectGitHubToken(url: string, token: string): string {
  if (!token) {
    return url;
  }

  const match = url.match(/^https:\/\/github\.com\/(.+)$/);
  if (!match) {
    return url;
  }

  return `https://x-access-token:${token}@github.com/${match[1]}`;
}

export class ShellDeploymentCommandRunner implements DeploymentCommandRunner {
  constructor(
    private readonly execRunner: ExecFileRunner = execFileRunner,
    private readonly fallbackGithubToken: string = process.env.GITHUB_TOKEN ?? ''
  ) {}

  async cloneRepository(input: {
    gitRepositoryUrl: string;
    branch: string;
    repoDir: string;
    gitAccessToken?: string;
  }): Promise<void> {
    const token = input.gitAccessToken || this.fallbackGithubToken;
    const cloneUrl = injectGitHubToken(input.gitRepositoryUrl, token);
    await this.execRunner('git', [
      'clone',
      '--depth',
      '1',
      '--branch',
      input.branch,
      cloneUrl,
      input.repoDir
    ]);
  }

  async buildImage(input: {
    dockerfilePath: string;
    buildContextPath: string;
    imageTag: string;
    repoDir: string;
  }): Promise<void> {
    await this.execRunner(
      'docker',
      ['build', '-f', input.dockerfilePath, '-t', input.imageTag, input.buildContextPath],
      { cwd: input.repoDir }
    );
  }

  async removeImage(imageTag: string): Promise<void> {
    await this.execRunner('docker', ['image', 'rm', '-f', imageTag]);
  }
}
