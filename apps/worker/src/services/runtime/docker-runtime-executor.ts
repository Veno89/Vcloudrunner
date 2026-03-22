import type { RuntimeExecutor } from './runtime-executor.js';

interface DeploymentRunnerLike {
  run: RuntimeExecutor['run'];
  cleanupCancelledRun: RuntimeExecutor['cleanupCancelledRun'];
}

export class DockerRuntimeExecutor implements RuntimeExecutor {
  constructor(private readonly runner: DeploymentRunnerLike) {}

  run: RuntimeExecutor['run'] = (job) => {
    return this.runner.run(job);
  };

  cleanupCancelledRun: RuntimeExecutor['cleanupCancelledRun'] = (input) => {
    return this.runner.cleanupCancelledRun(input);
  };
}
