import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { DeploymentCommandRunner } from './deployment-command-runner.js';

const execFileAsync = promisify(execFile);

export class ShellDeploymentCommandRunner implements DeploymentCommandRunner {
  async cloneRepository(input: {
    gitRepositoryUrl: string;
    branch: string;
    repoDir: string;
  }): Promise<void> {
    await execFileAsync('git', [
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
    await execFileAsync(
      'docker',
      ['build', '-f', input.dockerfilePath, '-t', input.imageTag, '.'],
      { cwd: input.repoDir }
    );
  }

  async removeImage(imageTag: string): Promise<void> {
    await execFileAsync('docker', ['image', 'rm', '-f', imageTag]);
  }
}
