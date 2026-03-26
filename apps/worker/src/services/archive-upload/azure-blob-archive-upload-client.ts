import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

import type { AzureArchiveUploadClient } from './azure-archive-upload-client.js';

export class AzureBlobArchiveUploadClient implements AzureArchiveUploadClient {
  async uploadBlob(input: {
    serviceUrl: string;
    container: string;
    blobName: string;
    accountName: string;
    accountKey: string;
    payload: Buffer;
    contentType: string;
    signal: AbortSignal;
  }) {
    const client = new BlobServiceClient(
      input.serviceUrl,
      new StorageSharedKeyCredential(input.accountName, input.accountKey)
    );

    const blockBlobClient = client
      .getContainerClient(input.container)
      .getBlockBlobClient(input.blobName);

    await blockBlobClient.upload(input.payload, input.payload.length, {
      abortSignal: input.signal,
      blobHTTPHeaders: {
        blobContentType: input.contentType
      }
    });
  }
}
