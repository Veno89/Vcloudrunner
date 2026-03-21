import { ConfiguredDeploymentLogArchiveUploader } from './configured-deployment-log-archive-uploader.js';

export function createDeploymentLogArchiveUploader() {
  return new ConfiguredDeploymentLogArchiveUploader();
}
