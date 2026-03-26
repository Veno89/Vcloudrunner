import { createS3ArchiveUploadClient } from './s3-archive-upload-client.factory.js';
import { S3ArchiveUploadProvider } from './s3-archive-upload-provider.js';

export function createS3ArchiveUploadProvider() {
  return new S3ArchiveUploadProvider(createS3ArchiveUploadClient());
}
