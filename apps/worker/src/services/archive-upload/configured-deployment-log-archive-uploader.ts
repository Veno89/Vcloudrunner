import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, ArchiveUploadRequest } from './archive-upload-provider.js';
import { createArchiveUploadProvider } from './archive-upload-provider.factory.js';
import type { DeploymentLogArchiveUploader } from './deployment-log-archive-uploader.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class ConfiguredDeploymentLogArchiveUploader implements DeploymentLogArchiveUploader {
  constructor(
    private readonly archiveUploadProvider: ArchiveUploadProvider = createArchiveUploadProvider()
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS);

      try {
        const response = await fetch(input.targetUrl, {
          method: 'PUT',
          headers: input.headers,
          body: new Uint8Array(input.payload),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`archive upload failed with status ${response.status}`);
        }

        return;
      } catch (error) {
        lastError = controller.signal.aborted
          ? new Error(`archive upload timed out after ${env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS}ms`)
          : new Error(`archive upload request failed: ${getErrorMessage(error)}`);

        if (attempt === env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS) {
          break;
        }

        const backoff = Math.min(
          env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS * 2 ** (attempt - 1),
          env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS
        );
        await sleep(backoff);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const message = getErrorMessage(lastError);
    throw new Error(`archive upload failed after retries: ${message}`);
  }
}
