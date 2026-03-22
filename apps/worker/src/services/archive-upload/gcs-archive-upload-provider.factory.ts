import { createOutboundHttpClient } from '../http/outbound-http-client.factory.js';
import { GcsArchiveUploadProvider } from './gcs-archive-upload-provider.js';

export function createGcsArchiveUploadProvider() {
  return new GcsArchiveUploadProvider(createOutboundHttpClient());
}
