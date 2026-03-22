import { createConfiguredDeploymentImageBuilder } from './configured-deployment-image-builder.factory.js';

export function createDeploymentImageBuilder() {
  return createConfiguredDeploymentImageBuilder();
}
