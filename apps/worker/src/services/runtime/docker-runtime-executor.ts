import { DeploymentRunner } from '../deployment-runner.js';
import type { RuntimeExecutor } from './runtime-executor.js';

export class DockerRuntimeExecutor implements RuntimeExecutor {
  private readonly runner = new DeploymentRunner();

  run = this.runner.run.bind(this.runner);

  cleanupCancelledRun = this.runner.cleanupCancelledRun.bind(this.runner);
}