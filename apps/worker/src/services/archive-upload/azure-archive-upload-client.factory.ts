import type { AzureArchiveUploadClient } from './azure-archive-upload-client.js';
import { AzureBlobArchiveUploadClient } from './azure-blob-archive-upload-client.js';

export function createAzureArchiveUploadClient(): AzureArchiveUploadClient {
  return new AzureBlobArchiveUploadClient();
}
