import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, AzureArchiveUploadRequest } from './archive-upload-provider.js';
import {
  encodeObjectKey,
  encodePathSegment,
  joinObjectKey
} from './archive-upload-provider.shared.js';
import type { AzureArchiveUploadClient } from './azure-archive-upload-client.js';

export class AzureArchiveUploadProvider implements ArchiveUploadProvider {
  constructor(private readonly archiveUploadClient: AzureArchiveUploadClient) {}

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<AzureArchiveUploadRequest> {
    const container = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER.trim();
    if (container.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER for azure provider');
    }

    const key = joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX, input.fileName);
    const targetUrl =
      `${input.baseUrl.replace(/\/$/, '')}/${encodePathSegment(container)}/${encodeObjectKey(key)}`;
    const accountName = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME.trim();
    const accountKey = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY.trim();
    if (accountName.length === 0 || accountKey.length === 0) {
      throw new Error(
        'missing DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME/DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY for azure provider'
      );
    }

    return {
      targetUrl,
      provider: 'azure',
      transport: 'native',
      container,
      blobName: key,
      serviceUrl: input.baseUrl,
      headers: {
        'content-type': 'application/gzip'
      }
    };
  }

  async uploadNative(input: {
    request: AzureArchiveUploadRequest;
    payload: Buffer;
    signal: AbortSignal;
  }) {
    const accountName = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME.trim();
    const accountKey = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY.trim();
    if (accountName.length === 0 || accountKey.length === 0) {
      throw new Error(
        'missing DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME/DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY for azure provider'
      );
    }

    await this.archiveUploadClient.uploadBlob({
      serviceUrl: input.request.serviceUrl,
      container: input.request.container,
      blobName: input.request.blobName,
      accountName,
      accountKey,
      payload: input.payload,
      contentType: input.request.headers['content-type'] ?? 'application/octet-stream',
      signal: input.signal
    });
  }
}
