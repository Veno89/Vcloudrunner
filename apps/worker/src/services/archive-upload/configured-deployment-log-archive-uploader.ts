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
    request: ArchiveUploadRequest;
    payload: Buffer;
  }) {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        if (input.request.transport === 'native') {
          if (!this.archiveUploadProvider.uploadNative) {
            throw new Error(`archive upload provider ${input.request.provider} does not support native uploads`);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS);

          try {
            await this.archiveUploadProvider.uploadNative({
              request: input.request,
              payload: input.payload,
              signal: controller.signal
            });
          } catch (error) {
            if (controller.signal.aborted) {
              throw new OutboundHttpRequestError({
                timedOut: true,
                message: `request timed out after ${env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS}ms`,
                cause: error
              });
            }

            throw error;
          } finally {
            clearTimeout(timeoutId);
          }
        } else {
          const response = await this.outboundHttpClient.request({
            url: input.request.targetUrl,
            timeoutMs: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS,
            init: {
              method: 'PUT',
              headers: input.request.headers,
              body: new Uint8Array(input.payload)
            }
          });

          if (!response.ok) {
            throw new Error(`archive upload failed with status ${response.status}`);
          }
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
