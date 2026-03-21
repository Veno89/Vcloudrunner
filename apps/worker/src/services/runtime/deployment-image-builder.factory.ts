import { ConfiguredDeploymentImageBuilder } from './configured-deployment-image-builder.js';

export function createDeploymentImageBuilder() {
  return new ConfiguredDeploymentImageBuilder();
}
