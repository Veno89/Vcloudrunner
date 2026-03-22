export type ArchiveUploadProviderName = 'http' | 's3' | 'gcs' | 'azure';

export interface ArchiveUploadRequest {
  targetUrl: string;
  headers: Record<string, string>;
}

export interface ArchiveUploadProvider {
  createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<ArchiveUploadRequest>;
}

export type ArchiveUploadProviders = Record<ArchiveUploadProviderName, ArchiveUploadProvider>;
