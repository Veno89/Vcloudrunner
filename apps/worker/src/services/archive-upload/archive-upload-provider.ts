export type ArchiveUploadProviderName = 'http' | 's3' | 'gcs' | 'azure';

interface BaseArchiveUploadRequest {
  provider: ArchiveUploadProviderName;
  targetUrl: string;
  headers: Record<string, string>;
}

export interface HttpArchiveUploadRequest extends BaseArchiveUploadRequest {
  provider: 'http' | 'gcs';
  transport: 'http';
}

export interface S3ArchiveUploadRequest extends BaseArchiveUploadRequest {
  provider: 's3';
  transport: 'native';
  bucket: string;
  key: string;
  endpoint: string;
}

export interface AzureArchiveUploadRequest extends BaseArchiveUploadRequest {
  provider: 'azure';
  transport: 'native';
  container: string;
  blobName: string;
  serviceUrl: string;
}

export type NativeArchiveUploadRequest = S3ArchiveUploadRequest | AzureArchiveUploadRequest;

export type ArchiveUploadRequest = HttpArchiveUploadRequest | NativeArchiveUploadRequest;

export interface ArchiveUploadProvider {
  createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<ArchiveUploadRequest>;
  uploadNative?(input: {
    request: NativeArchiveUploadRequest;
    payload: Buffer;
    signal: AbortSignal;
  }): Promise<void>;
}

export type ArchiveUploadProviders = Record<ArchiveUploadProviderName, ArchiveUploadProvider>;
