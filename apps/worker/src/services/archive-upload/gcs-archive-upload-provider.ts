import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, HttpArchiveUploadRequest } from './archive-upload-provider.js';
import {
  encodeObjectKey,
  encodePathSegment,
  joinObjectKey
} from './archive-upload-provider.shared.js';
import type { GcsAccessTokenResolver } from './gcs-access-token-resolver.js';

export class GcsArchiveUploadProvider implements ArchiveUploadProvider {
  constructor(private readonly accessTokenResolver: GcsAccessTokenResolver) {}

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<HttpArchiveUploadRequest> {
    const bucket = env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET.trim();
    if (bucket.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET for gcs provider');
    }

    const key = joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX, input.fileName);
    const targetUrl =
      `${input.baseUrl.replace(/\/$/, '')}/${encodePathSegment(bucket)}/${encodeObjectKey(key)}`;
    const token = await this.accessTokenResolver.resolveAccessToken();

    return {
      provider: 'gcs',
      transport: 'http',
      targetUrl,
      headers: {
        'content-type': 'application/gzip',
        authorization: `Bearer ${token}`
      }
    };
  }
}
