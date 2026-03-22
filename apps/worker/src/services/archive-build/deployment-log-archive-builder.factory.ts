import { GzipNdjsonDeploymentLogArchiveBuilder } from './gzip-ndjson-deployment-log-archive-builder.js';

export function createDeploymentLogArchiveBuilder() {
  return new GzipNdjsonDeploymentLogArchiveBuilder();
}
