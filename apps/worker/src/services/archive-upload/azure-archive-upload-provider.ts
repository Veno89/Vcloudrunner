import { createHmac } from 'node:crypto';

import { env } from '../../config/env.js';
import type { ArchiveUploadProvider } from './archive-upload-provider.js';
import {
  encodeObjectKey,
  encodePathSegment,
  joinObjectKey
} from './archive-upload-provider.shared.js';

export class AzureArchiveUploadProvider implements ArchiveUploadProvider {
  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }) {
    const container = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER.trim();
    if (container.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER for azure provider');
    }

    const key = joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX, input.fileName);
    const targetUrl =
      `${input.baseUrl.replace(/\/$/, '')}/${encodePathSegment(container)}/${encodeObjectKey(key)}`;

    return {
      targetUrl,
      headers: this.buildAzureUploadHeaders({ targetUrl, payload: input.payload })
    };
  }

  private buildAzureUploadHeaders(input: { targetUrl: string; payload: Buffer }) {
    const accountName = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME.trim();
    const accountKey = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY.trim();
    if (accountName.length === 0 || accountKey.length === 0) {
      throw new Error(
        'missing DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME/DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY for azure provider'
      );
    }

    const url = new URL(input.targetUrl);
    const now = new Date().toUTCString();
    const version = '2023-11-03';
    const contentLength = `${input.payload.length}`;
    const canonicalizedHeaders = `x-ms-blob-type:BlockBlob\nx-ms-date:${now}\nx-ms-version:${version}`;
    const canonicalizedResource = `/${accountName}${url.pathname}`;

    const stringToSign = [
      'PUT',
      '',
      '',
      contentLength,
      '',
      'application/gzip',
      '',
      '',
      '',
      '',
      '',
      '',
      canonicalizedHeaders,
      canonicalizedResource
    ].join('\n');

    const signature = createHmac('sha256', Buffer.from(accountKey, 'base64'))
      .update(stringToSign, 'utf8')
      .digest('base64');

    return {
      'content-type': 'application/gzip',
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-date': now,
      'x-ms-version': version,
      authorization: `SharedKey ${accountName}:${signature}`
    };
  }
}
