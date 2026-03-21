import type { DeploymentCommandRunner } from './deployment-command-runner.js';
import { ShellDeploymentCommandRunner } from './shell-deployment-command-runner.js';

export function createDeploymentCommandRunner(): DeploymentCommandRunner {
  return new ShellDeploymentCommandRunner();
}
