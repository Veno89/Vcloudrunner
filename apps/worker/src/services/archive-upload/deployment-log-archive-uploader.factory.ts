import { createConfiguredDeploymentLogArchiveUploader } from './configured-deployment-log-archive-uploader.factory.js';

export function createDeploymentLogArchiveUploader() {
  return createConfiguredDeploymentLogArchiveUploader();
}
