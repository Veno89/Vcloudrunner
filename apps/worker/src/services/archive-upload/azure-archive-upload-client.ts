export interface AzureArchiveUploadClient {
  uploadBlob(input: {
    serviceUrl: string;
    container: string;
    blobName: string;
    accountName: string;
    accountKey: string;
    payload: Buffer;
    contentType: string;
    signal: AbortSignal;
  }): Promise<void>;
}
