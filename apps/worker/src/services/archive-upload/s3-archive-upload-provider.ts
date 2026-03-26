import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, S3ArchiveUploadRequest } from './archive-upload-provider.js';
import {
  encodeObjectKey,
  encodePathSegment,
  joinObjectKey
} from './archive-upload-provider.shared.js';
import type { S3ArchiveUploadClient } from './s3-archive-upload-client.js';

export class S3ArchiveUploadProvider implements ArchiveUploadProvider {
  constructor(private readonly archiveUploadClient: S3ArchiveUploadClient) {}

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<S3ArchiveUploadRequest> {
    const bucket = env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET.trim();
    if (bucket.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET for s3 provider');
    }

    const key = joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX, input.fileName);
    const targetUrl =
      `${input.baseUrl.replace(/\/$/, '')}/${encodePathSegment(bucket)}/${encodeObjectKey(key)}`;
    const accessKeyId = env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID.trim();
    const secretAccessKey = env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY.trim();
    if (accessKeyId.length === 0 || secretAccessKey.length === 0) {
      throw new Error(
        'missing DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID/DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY for s3 provider'
      );
    }

    return {
      targetUrl,
      provider: 's3',
      transport: 'native',
      bucket,
      key,
      endpoint: input.baseUrl,
      headers: {
        'content-type': 'application/gzip'
      }
    };
  }

  async uploadNative(input: {
    request: S3ArchiveUploadRequest;
    payload: Buffer;
    signal: AbortSignal;
  }) {
    const accessKeyId = env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID.trim();
    const secretAccessKey = env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY.trim();
    const region = env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION.trim();
    if (accessKeyId.length === 0 || secretAccessKey.length === 0) {
      throw new Error(
        'missing DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID/DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY for s3 provider'
      );
    }

    const sessionToken = env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN.trim();
    await this.archiveUploadClient.uploadObject({
      endpoint: input.request.endpoint,
      bucket: input.request.bucket,
      key: input.request.key,
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: sessionToken.length > 0 ? sessionToken : undefined,
      payload: input.payload,
      contentType: input.request.headers['content-type'] ?? 'application/octet-stream',
      signal: input.signal
    });
  }
}
