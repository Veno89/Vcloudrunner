import { createConfiguredOutboundHttpClient } from '../http/configured-outbound-http-client.factory.js';
import { createConfiguredArchiveUploadProvider } from './configured-archive-upload-provider.factory.js';
import { ConfiguredDeploymentLogArchiveUploader } from './configured-deployment-log-archive-uploader.js';

export function createConfiguredDeploymentLogArchiveUploader() {
  return new ConfiguredDeploymentLogArchiveUploader(
    createConfiguredArchiveUploadProvider(),
    createConfiguredOutboundHttpClient()
  );
}
