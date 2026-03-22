import { env } from '../../config/env.js';
import type { OutboundHttpClient } from '../http/outbound-http-client.js';
import { OutboundHttpRequestError } from '../http/outbound-http-client.js';
import type { ArchiveUploadProvider, ArchiveUploadRequest } from './archive-upload-provider.js';
import type { DeploymentLogArchiveUploader } from './deployment-log-archive-uploader.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ConfiguredDeploymentLogArchiveUploader implements DeploymentLogArchiveUploader {
  constructor(
    private readonly archiveUploadProvider: ArchiveUploadProvider,
    private readonly outboundHttpClient: OutboundHttpClient
  ) {}

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<ArchiveUploadRequest> {
    return this.archiveUploadProvider.createUploadRequest(input);
  }

  async uploadWithRetry(input: {
    targetUrl: string;
    payload: Buffer;
    headers: Record<string, string>;
  }) {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.outboundHttpClient.request({
          url: input.targetUrl,
          timeoutMs: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS,
          init: {
            method: 'PUT',
            headers: input.headers,
            body: new Uint8Array(input.payload)
          }
        });

        if (!response.ok) {
          throw new Error(`archive upload failed with status ${response.status}`);
        }

        return;
      } catch (error) {
        lastError =
          error instanceof OutboundHttpRequestError && error.timedOut
            ? new Error(`archive upload ${error.message}`)
            : new Error(
                `archive upload request failed: ${error instanceof Error ? error.message : String(error)}`
              );

        if (attempt === env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS) {
          break;
        }

        const backoff = Math.min(
          env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS * 2 ** (attempt - 1),
          env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS
        );
        await sleep(backoff);
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`archive upload failed after retries: ${message}`);
  }
}
