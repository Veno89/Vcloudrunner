import type { ArchiveUploadRequest } from './archive-upload-provider.js';

export interface DeploymentLogArchiveUploader {
  createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<ArchiveUploadRequest>;
  uploadWithRetry(input: {
    targetUrl: string;
    payload: Buffer;
    headers: Record<string, string>;
  }): Promise<void>;
}
