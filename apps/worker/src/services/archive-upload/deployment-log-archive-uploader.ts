import type { ArchiveUploadRequest } from './archive-upload-provider.js';

export interface DeploymentLogArchiveUploader {
  createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<ArchiveUploadRequest>;
  uploadWithRetry(input: {
    request: ArchiveUploadRequest;
    payload: Buffer;
  }): Promise<void>;
}
