export interface S3ArchiveUploadClient {
  uploadObject(input: {
    endpoint: string;
    bucket: string;
    key: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    payload: Buffer;
    contentType: string;
    signal: AbortSignal;
  }): Promise<void>;
}
