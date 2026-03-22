import type { ArchiveUploadProviders } from './archive-upload-provider.js';
import { AzureArchiveUploadProvider } from './azure-archive-upload-provider.js';
import { createGcsArchiveUploadProvider } from './gcs-archive-upload-provider.factory.js';
import { HttpArchiveUploadProvider } from './http-archive-upload-provider.js';
import { S3ArchiveUploadProvider } from './s3-archive-upload-provider.js';

export function createArchiveUploadProviders(): ArchiveUploadProviders {
  return {
    http: new HttpArchiveUploadProvider(),
    s3: new S3ArchiveUploadProvider(),
    gcs: createGcsArchiveUploadProvider(),
    azure: new AzureArchiveUploadProvider()
  };
}
