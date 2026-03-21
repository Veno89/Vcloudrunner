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
