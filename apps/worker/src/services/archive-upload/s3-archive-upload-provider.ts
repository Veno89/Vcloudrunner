import { createHmac } from 'node:crypto';

import { env } from '../../config/env.js';
import type { ArchiveUploadProvider } from './archive-upload-provider.js';
import {
  encodeObjectKey,
  encodePathSegment,
  formatAmzDate,
  hmac,
  joinObjectKey,
  sha256Hex
} from './archive-upload-provider.shared.js';

export class S3ArchiveUploadProvider implements ArchiveUploadProvider {
  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }) {
    const bucket = env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET.trim();
    if (bucket.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET for s3 provider');
    }

    const key = joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX, input.fileName);
    const targetUrl =
      `${input.baseUrl.replace(/\/$/, '')}/${encodePathSegment(bucket)}/${encodeObjectKey(key)}`;

    return {
      targetUrl,
      headers: this.buildS3UploadHeaders({ targetUrl, payload: input.payload })
    };
  }

  private buildS3UploadHeaders(input: { targetUrl: string; payload: Buffer }) {
    const accessKeyId = env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID.trim();
    const secretAccessKey = env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY.trim();
    const region = env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION.trim();
    if (accessKeyId.length === 0 || secretAccessKey.length === 0) {
      throw new Error(
        'missing DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID/DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY for s3 provider'
      );
    }

    const url = new URL(input.targetUrl);
    const timestamp = new Date();
    const amzDate = formatAmzDate(timestamp);
    const shortDate = amzDate.slice(0, 8);

    const payloadHash = sha256Hex(input.payload);
    const sessionToken = env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN.trim();

    const headerEntries: Array<[string, string]> = [
      ['host', url.host],
      ['x-amz-content-sha256', payloadHash],
      ['x-amz-date', amzDate]
    ];

    if (sessionToken.length > 0) {
      headerEntries.push(['x-amz-security-token', sessionToken]);
    }

    const canonicalHeaders = `${headerEntries.map(([key, value]) => `${key}:${value}`).join('\n')}\n`;
    const signedHeaders = headerEntries.map(([key]) => key).join(';');
    const canonicalRequest = [
      'PUT',
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const credentialScope = `${shortDate}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');

    const kDate = hmac(`AWS4${secretAccessKey}`, shortDate);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const headers: Record<string, string> = {
      'content-type': 'application/gzip',
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    };

    if (sessionToken.length > 0) {
      headers['x-amz-security-token'] = sessionToken;
    }

    return headers;
  }
}
