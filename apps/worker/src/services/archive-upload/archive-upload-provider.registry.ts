import type { ArchiveUploadProviders } from './archive-upload-provider.js';
import { createAzureArchiveUploadProvider } from './azure-archive-upload-provider.factory.js';
import { createGcsArchiveUploadProvider } from './gcs-archive-upload-provider.factory.js';
import { createHttpArchiveUploadProvider } from './http-archive-upload-provider.factory.js';
import { createS3ArchiveUploadProvider } from './s3-archive-upload-provider.factory.js';

export function createArchiveUploadProviders(): ArchiveUploadProviders {
  return {
    http: createHttpArchiveUploadProvider(),
    s3: createS3ArchiveUploadProvider(),
    gcs: createGcsArchiveUploadProvider(),
    azure: createAzureArchiveUploadProvider()
  };
}
