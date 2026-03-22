import { createBuildSystemResolver } from '../build-detection/build-system-resolver.factory.js';
import { createDeploymentCommandRunner } from './deployment-command-runner.factory.js';
import { ConfiguredDeploymentImageBuilder } from './configured-deployment-image-builder.js';

export function createConfiguredDeploymentImageBuilder() {
  return new ConfiguredDeploymentImageBuilder(
    createDeploymentCommandRunner(),
    createBuildSystemResolver()
  );
}
