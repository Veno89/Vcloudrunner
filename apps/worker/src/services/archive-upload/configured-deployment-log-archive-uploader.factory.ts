import { createOutboundHttpClient } from '../http/outbound-http-client.factory.js';
import { createArchiveUploadProvider } from './archive-upload-provider.factory.js';
import { ConfiguredDeploymentLogArchiveUploader } from './configured-deployment-log-archive-uploader.js';

export function createConfiguredDeploymentLogArchiveUploader() {
  return new ConfiguredDeploymentLogArchiveUploader(
    createArchiveUploadProvider(),
    createOutboundHttpClient()
  );
}
