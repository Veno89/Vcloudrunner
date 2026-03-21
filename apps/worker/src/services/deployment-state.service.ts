import { createHash, createHmac, createSign } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { DeploymentStateRepository, type Queryable, type SuccessInput } from './deployment-state.repository.js';

interface ArchiveUploadRequest {
  targetUrl: string;
  headers: Record<string, string>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Hex(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Uint8Array | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function normalizePrivateKey(raw: string) {
  return raw.replace(/\\n/g, '\n');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class DeploymentStateService {
  private readonly repository: DeploymentStateRepository;
  private gcsAccessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(pool?: Queryable) {
    this.repository = new DeploymentStateRepository(pool);
  }

  async markBuilding(deploymentId: string) {
    await this.repository.markBuilding(deploymentId);
  }

  async markRunning(input: SuccessInput) {
    await this.repository.markRunning(input);
  }

  async markFailed(deploymentId: string, message: string) {
    await this.repository.markStatusFailed(deploymentId);
    await this.appendTransitionLogBestEffort({
      deploymentId,
      level: 'error',
      message,
      action: 'failed'
    });
    await this.enforceRetentionBestEffort(deploymentId);
  }

  async markStopped(deploymentId: string, message: string) {
    await this.repository.markStatusStopped(deploymentId);
    await this.appendTransitionLogBestEffort({
      deploymentId,
      level: 'warn',
      message,
      action: 'stopped'
    });
    await this.enforceRetentionBestEffort(deploymentId);
  }

  async isCancellationRequested(deploymentId: string) {
    return this.repository.isCancellationRequested(deploymentId);
  }

  async appendLog(deploymentId: string, message: string, level = 'info') {
    await this.repository.insertLog({ deploymentId, level, message });
    await this.enforceRetentionBestEffort(deploymentId);
  }

  async pruneLogsByRetentionWindow() {
    await this.repository.pruneLogsByRetentionWindow();
  }

  async recoverStuckDeployments() {
    const rows = await this.repository.listStuckDeployments();
    let recoveredCount = 0;

    for (const row of rows) {
      const reason = row.status === 'queued'
        ? `DEPLOYMENT_STUCK_RECOVERY: queued deployment exceeded ${env.DEPLOYMENT_STUCK_QUEUED_MAX_AGE_MINUTES} minutes`
        : `DEPLOYMENT_STUCK_RECOVERY: building deployment exceeded ${env.DEPLOYMENT_STUCK_BUILDING_MAX_AGE_MINUTES} minutes`;

      try {
        await this.markFailed(row.id, reason);
        recoveredCount += 1;
      } catch (error) {
        logger.warn('stuck deployment recovery failed for one deployment', {
          deploymentId: row.id,
          status: row.status,
          message: getErrorMessage(error)
        });
      }
    }

    return recoveredCount;
  }

  async reconcileRunningDeployments(
    isContainerRunning: (containerId: string) => Promise<boolean>
  ) {
    const rows = await this.repository.listRunningDeploymentContainers();
    let reconciledCount = 0;

    for (const row of rows) {
      try {
        const running = await isContainerRunning(row.container_id);
        if (!running) {
          await this.markFailed(
            row.deployment_id,
            'STATE_RECONCILIATION: container not found or not running on worker startup'
          );
          reconciledCount += 1;
        }
      } catch (error) {
        logger.warn('running deployment reconciliation failed for one deployment', {
          deploymentId: row.deployment_id,
          containerId: row.container_id,
          message: getErrorMessage(error)
        });
      }
    }

    return reconciledCount;
  }

  async archiveEligibleDeploymentLogs() {
    const candidates = await this.repository.listArchivableDeploymentIds();
    let archivedCount = 0;

    await mkdir(env.DEPLOYMENT_LOG_ARCHIVE_DIR, { recursive: true });

    for (const deploymentId of candidates) {
      try {
        const wasArchived = await this.archiveDeployment(deploymentId);
        if (wasArchived) {
          archivedCount += 1;
        }
      } catch (error) {
        logger.warn('deployment log archive failed for one deployment', {
          deploymentId,
          message: getErrorMessage(error)
        });
      }
    }

    return archivedCount;
  }

  async uploadPendingArchives() {
    const baseUrl = env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL.trim();
    if (baseUrl.length === 0) {
      return 0;
    }

    await mkdir(env.DEPLOYMENT_LOG_ARCHIVE_DIR, { recursive: true });
    const entries = await readdir(env.DEPLOYMENT_LOG_ARCHIVE_DIR);

    let uploadedCount = 0;

    for (const fileName of entries) {
      if (!fileName.endsWith('.ndjson.gz')) {
        continue;
      }

      const archivePath = join(env.DEPLOYMENT_LOG_ARCHIVE_DIR, fileName);
      const markerPath = `${archivePath}.uploaded`;

      if (await this.fileExists(markerPath)) {
        continue;
      }

      try {
        const payload = await readFile(archivePath);
        const uploadRequest = await this.createArchiveUploadRequest({ fileName, baseUrl, payload });

        await this.uploadArchiveWithRetry({
          targetUrl: uploadRequest.targetUrl,
          payload,
          headers: uploadRequest.headers
        });

        await writeFile(
          markerPath,
          JSON.stringify({ uploadedAt: new Date().toISOString(), targetUrl: uploadRequest.targetUrl })
        );

        if (env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD) {
          try {
            await unlink(archivePath);
          } catch (error) {
            logger.warn('deployment log archive local cleanup failed after upload', {
              fileName,
              archivePath,
              message: getErrorMessage(error)
            });
          }
        }

        uploadedCount += 1;
      } catch (error) {
        logger.warn('deployment log archive upload failed for one artifact', {
          fileName,
          archivePath,
          message: getErrorMessage(error)
        });
      }
    }

    return uploadedCount;
  }

  async cleanupArchivedArtifacts() {
    await mkdir(env.DEPLOYMENT_LOG_ARCHIVE_DIR, { recursive: true });
    const entries = await readdir(env.DEPLOYMENT_LOG_ARCHIVE_DIR);

    const now = Date.now();
    const archiveMaxAgeMs = env.DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const markerMaxAgeMs = env.DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const fileName of entries) {
      const filePath = join(env.DEPLOYMENT_LOG_ARCHIVE_DIR, fileName);

      if (!fileName.endsWith('.ndjson.gz') && !fileName.endsWith('.ndjson.gz.uploaded')) {
        continue;
      }

      try {
        const info = await stat(filePath);
        const ageMs = now - info.mtimeMs;

        if (fileName.endsWith('.ndjson.gz.uploaded')) {
          if (ageMs > markerMaxAgeMs) {
            await unlink(filePath);
            deletedCount += 1;
          }
          continue;
        }

        const markerPath = `${filePath}.uploaded`;
        const hasMarker = await this.fileExists(markerPath);

        if (hasMarker && ageMs > archiveMaxAgeMs) {
          await unlink(filePath);
          deletedCount += 1;
        }
      } catch (error) {
        logger.warn('deployment log archive cleanup failed for one artifact', {
          fileName,
          filePath,
          message: getErrorMessage(error)
        });
      }
    }

    return deletedCount;
  }

  async createArchiveUploadRequest(input: { fileName: string; baseUrl: string; payload: Buffer }): Promise<ArchiveUploadRequest> {
    const targetUrl = this.buildArchiveUploadTargetUrl({ fileName: input.fileName, baseUrl: input.baseUrl });

    if (env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER === 'http') {
      return {
        targetUrl,
        headers: {
          'content-type': 'application/gzip',
          ...(env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN
            ? { authorization: `Bearer ${env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN}` }
            : {})
        }
      };
    }

    if (env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER === 's3') {
      return {
        targetUrl,
        headers: this.buildS3UploadHeaders({ targetUrl, payload: input.payload })
      };
    }

    if (env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER === 'gcs') {
      const token = await this.resolveGcsAccessToken();
      return {
        targetUrl,
        headers: {
          'content-type': 'application/gzip',
          authorization: `Bearer ${token}`
        }
      };
    }

    return {
      targetUrl,
      headers: this.buildAzureUploadHeaders({ targetUrl, payload: input.payload })
    };
  }

  private buildArchiveUploadTargetUrl(input: { fileName: string; baseUrl: string }) {
    const normalizedBase = input.baseUrl.replace(/\/$/, '');

    if (env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER === 'http') {
      return `${normalizedBase}/${encodeURIComponent(input.fileName)}`;
    }

    if (env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER === 's3') {
      if (env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET.trim().length === 0) {
        throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET for s3 provider');
      }

      const key = this.joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX, input.fileName);
      return `${normalizedBase}/${this.encodePathSegment(env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET)}/${this.encodeObjectKey(key)}`;
    }

    if (env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER === 'gcs') {
      if (env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET.trim().length === 0) {
        throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET for gcs provider');
      }

      const key = this.joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX, input.fileName);
      return `${normalizedBase}/${this.encodePathSegment(env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET)}/${this.encodeObjectKey(key)}`;
    }

    if (env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER.trim().length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER for azure provider');
    }

    const key = this.joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX, input.fileName);
    return `${normalizedBase}/${this.encodePathSegment(env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER)}/${this.encodeObjectKey(key)}`;
  }

  private buildS3UploadHeaders(input: { targetUrl: string; payload: Buffer }) {
    const accessKeyId = env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID.trim();
    const secretAccessKey = env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY.trim();
    const region = env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION.trim();
    if (accessKeyId.length === 0 || secretAccessKey.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID/DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY for s3 provider');
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

  private buildAzureUploadHeaders(input: { targetUrl: string; payload: Buffer }) {
    const accountName = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME.trim();
    const accountKey = env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY.trim();
    if (accountName.length === 0 || accountKey.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME/DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY for azure provider');
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

  private async resolveGcsAccessToken() {
    const staticToken = env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN.trim();
    if (staticToken.length > 0) {
      return staticToken;
    }

    if (this.gcsAccessTokenCache && Date.now() < this.gcsAccessTokenCache.expiresAt - 60_000) {
      return this.gcsAccessTokenCache.token;
    }

    const clientEmail = env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL.trim();
    const privateKey = normalizePrivateKey(env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY.trim());
    if (clientEmail.length === 0 || privateKey.length === 0) {
      throw new Error('missing GCS credentials: set DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN or service-account email/private key');
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/devstorage.read_write',
        aud: 'https://oauth2.googleapis.com/token',
        iat: issuedAt,
        exp: expiresAt
      })
    ).toString('base64url');

    const unsignedToken = `${header}.${claimSet}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsignedToken);
    signer.end();
    const signature = signer.sign(privateKey).toString('base64url');
    const assertion = `${unsignedToken}.${signature}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion
        }),
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(
        controller.signal.aborted
          ? `failed to obtain GCS access token: request timed out after ${env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS}ms`
          : `failed to obtain GCS access token: request failed: ${getErrorMessage(error)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`failed to obtain GCS access token: ${response.status}`);
    }

    let data: { access_token?: unknown; expires_in?: unknown };
    try {
      data = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    } catch {
      throw new Error('failed to obtain GCS access token: invalid JSON response');
    }

    const accessToken = typeof data.access_token === 'string' ? data.access_token.trim() : '';
    if (accessToken.length === 0) {
      throw new Error('failed to obtain GCS access token: missing access_token');
    }

    const expiresInSeconds =
      typeof data.expires_in === 'number' && Number.isFinite(data.expires_in) && data.expires_in > 0
        ? data.expires_in
        : 3600;

    const expiryMs = Date.now() + expiresInSeconds * 1000;
    this.gcsAccessTokenCache = { token: accessToken, expiresAt: expiryMs };
    return accessToken;
  }

  private joinObjectKey(prefix: string, fileName: string) {
    const cleanedPrefix = prefix.trim().replace(/^\/+|\/+$/g, '');
    return cleanedPrefix.length > 0 ? `${cleanedPrefix}/${fileName}` : fileName;
  }

  private encodePathSegment(value: string) {
    return encodeURIComponent(value);
  }

  private encodeObjectKey(key: string) {
    return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  }

  private async uploadArchiveWithRetry(input: { targetUrl: string; payload: Buffer; headers: Record<string, string> }) {
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

  private async archiveDeployment(deploymentId: string) {
    const archivePath = join(env.DEPLOYMENT_LOG_ARCHIVE_DIR, `${deploymentId}.ndjson.gz`);

    const exists = await this.fileExists(archivePath);
    if (exists) {
      return false;
    }

    const rows = await this.repository.listDeploymentLogsByDeployment(deploymentId);
    if (rows.length === 0) {
      return false;
    }

    const ndjson =
      rows
        .map((item) =>
          JSON.stringify({
            id: item.id,
            deploymentId: item.deployment_id,
            level: item.level,
            message: item.message,
            timestamp: item.timestamp
          })
        )
        .join('\n') + '\n';

    const compressed = gzipSync(ndjson);
    await writeFile(archivePath, compressed);
    return true;
  }

  private async fileExists(path: string) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async enforceRetentionBestEffort(deploymentId: string) {
    try {
      await this.repository.enforceRetentionForDeployment(deploymentId);
    } catch (error) {
      logger.warn('deployment log retention enforcement failed after write', {
        deploymentId,
        message: getErrorMessage(error)
      });
    }
  }

  private async appendTransitionLogBestEffort(input: {
    deploymentId: string;
    level: string;
    message: string;
    action: 'failed' | 'stopped';
  }) {
    try {
      await this.repository.insertLog({
        deploymentId: input.deploymentId,
        level: input.level,
        message: input.message
      });
    } catch (error) {
      logger.warn(`deployment ${input.action} log insert failed after status update`, {
        deploymentId: input.deploymentId,
        message: getErrorMessage(error)
      });
    }
  }
}
