import type { DeploymentLogArchiveBuilder } from './deployment-log-archive-builder.js';
import { GzipNdjsonDeploymentLogArchiveBuilder } from './gzip-ndjson-deployment-log-archive-builder.js';

export type DeploymentLogArchiveBuilderConstructor = new () => DeploymentLogArchiveBuilder;

export interface CreateConfiguredDeploymentLogArchiveBuilderOptions {
  BuilderClass?: DeploymentLogArchiveBuilderConstructor;
}

export function createConfiguredDeploymentLogArchiveBuilder(
  options: CreateConfiguredDeploymentLogArchiveBuilderOptions = {}
): DeploymentLogArchiveBuilder {
  const BuilderClass = options.BuilderClass ?? GzipNdjsonDeploymentLogArchiveBuilder;
  return new BuilderClass();
}
