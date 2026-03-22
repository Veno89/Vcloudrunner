import { createDeploymentRunner } from '../deployment-runner.factory.js';
import { DockerRuntimeExecutor } from './docker-runtime-executor.js';

export function createDockerRuntimeExecutor() {
  return new DockerRuntimeExecutor(createDeploymentRunner());
}
