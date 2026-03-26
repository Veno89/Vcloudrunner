import { createAzureArchiveUploadClient } from './azure-archive-upload-client.factory.js';
import { AzureArchiveUploadProvider } from './azure-archive-upload-provider.js';

export function createAzureArchiveUploadProvider() {
  return new AzureArchiveUploadProvider(createAzureArchiveUploadClient());
}
