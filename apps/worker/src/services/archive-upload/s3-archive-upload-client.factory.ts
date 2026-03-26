import type { S3ArchiveUploadClient } from './s3-archive-upload-client.js';
import { AwsSdkS3ArchiveUploadClient } from './aws-sdk-s3-archive-upload-client.js';

export function createS3ArchiveUploadClient(): S3ArchiveUploadClient {
  return new AwsSdkS3ArchiveUploadClient();
}
