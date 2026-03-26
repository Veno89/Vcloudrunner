import {
  createConfiguredDeploymentLogArchiveBuilder,
  type CreateConfiguredDeploymentLogArchiveBuilderOptions
} from './configured-deployment-log-archive-builder.factory.js';

export function createDeploymentLogArchiveBuilder(
  options: CreateConfiguredDeploymentLogArchiveBuilderOptions = {}
) {
  return createConfiguredDeploymentLogArchiveBuilder(options);
}
