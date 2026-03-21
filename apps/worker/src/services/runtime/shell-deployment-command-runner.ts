import { execFileRunner, type ExecFileRunner } from '../process-exec-file-runner.js';
import type { DeploymentCommandRunner } from './deployment-command-runner.js';

export class ShellDeploymentCommandRunner implements DeploymentCommandRunner {
  constructor(private readonly execRunner: ExecFileRunner = execFileRunner) {}

  async cloneRepository(input: {
    gitRepositoryUrl: string;
    branch: string;
    repoDir: string;
  }): Promise<void> {
    await this.execRunner('git', [
      'clone',
      '--depth',
      '1',
      '--branch',
      input.branch,
      input.gitRepositoryUrl,
      input.repoDir
    ]);
  }

  async buildImage(input: {
    dockerfilePath: string;
    imageTag: string;
    repoDir: string;
  }): Promise<void> {
    await this.execRunner(
      'docker',
      ['build', '-f', input.dockerfilePath, '-t', input.imageTag, '.'],
      { cwd: input.repoDir }
    );
  }

  async removeImage(imageTag: string): Promise<void> {
    await this.execRunner('docker', ['image', 'rm', '-f', imageTag]);
  }
}
