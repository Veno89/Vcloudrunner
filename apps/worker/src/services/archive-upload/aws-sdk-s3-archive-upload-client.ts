import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import { env } from '../../config/env.js';
import type { S3ArchiveUploadClient } from './s3-archive-upload-client.js';

export class AwsSdkS3ArchiveUploadClient implements S3ArchiveUploadClient {
  async uploadObject(input: {
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
  }) {
    const client = new S3Client({
      endpoint: input.endpoint,
      forcePathStyle: true,
      region: input.region,
      maxAttempts: 1,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS,
        requestTimeout: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS
      }),
      credentials: {
        accessKeyId: input.accessKeyId,
        secretAccessKey: input.secretAccessKey,
        ...(input.sessionToken ? { sessionToken: input.sessionToken } : {})
      }
    });

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          Body: input.payload,
          ContentType: input.contentType
        }),
        {
          abortSignal: input.signal
        }
      );
    } finally {
      client.destroy();
    }
  }
}
