import { createHash, createHmac, createSign } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Pool } from 'pg';

import { env } from '../config/env.js';

interface SuccessInput {
  deploymentId: string;
  containerId: string;
  imageTag: string;
  internalPort: number;
  hostPort: number | null;
  runtimeUrl: string | null;
  projectId: string;
  projectSlug: string;
}

interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
}

interface ArchiveCandidateRow {
  id: string;
}

interface DeploymentLogRow {
  id: string;
  deployment_id: string;
  level: string;
  message: string;
  timestamp: string;
}

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

export class DeploymentStateService {
  private readonly pool: Queryable;
  private gcsAccessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(pool?: Queryable) {
    this.pool = pool ?? new Pool({ connectionString: env.DATABASE_URL });
  }

  async markBuilding(deploymentId: string) {
    await this.pool.query(
      `update deployments
       set status = 'building', started_at = now(), updated_at = now()
       where id = $1`,
      [deploymentId]
    );
  }

  async markRunning(input: SuccessInput) {
    await this.pool.query('begin');
    try {
      await this.pool.query(
        `update deployments
         set status = 'running', runtime_url = $2, updated_at = now()
         where id = $1`,
        [input.deploymentId, input.runtimeUrl]
      );

      if (input.hostPort !== null) {
        await this.pool.query(
          `insert into containers (deployment_id, container_id, image, internal_port, host_port, is_healthy)
           values ($1, $2, $3, $4, $5, false)
           on conflict (deployment_id) do update
           set container_id = excluded.container_id,
               image = excluded.image,
               internal_port = excluded.internal_port,
               host_port = excluded.host_port,
               updated_at = now()`,
          [input.deploymentId, input.containerId, input.imageTag, input.internalPort, input.hostPort]
        );

        await this.pool.query(
          `insert into domains (project_id, deployment_id, host, target_port)
           values ($1, $2, $3, $4)
           on conflict (host) do update
           set deployment_id = excluded.deployment_id,
               target_port = excluded.target_port,
               updated_at = now()`,
          [input.projectId, input.deploymentId, `${input.projectSlug}.${env.PLATFORM_DOMAIN}`, input.hostPort]
        );
      }

      await this.pool.query('commit');
    } catch (error) {
      await this.pool.query('rollback');
      throw error;
    }
  }

  async markFailed(deploymentId: string, message: string) {
    await this.pool.query(
      `update deployments
       set status = 'failed', finished_at = now(), updated_at = now()
       where id = $1`,
      [deploymentId]
    );

    await this.pool.query(
      `insert into deployment_logs (deployment_id, level, message)
       values ($1, 'error', $2)`,
      [deploymentId, message.slice(0, 10000)]
    );

    await this.enforceRetentionForDeployment(deploymentId);
  }

  async appendLog(deploymentId: string, message: string, level = 'info') {
    await this.pool.query(
      `insert into deployment_logs (deployment_id, level, message)
       values ($1, $2, $3)`,
      [deploymentId, level, message.slice(0, 10000)]
    );

    await this.enforceRetentionForDeployment(deploymentId);
  }

  async pruneLogsByRetentionWindow() {
    await this.pool.query(
      `delete from deployment_logs
       where timestamp < now() - ($1::int * interval '1 day')`,
      [env.DEPLOYMENT_LOG_RETENTION_DAYS]
    );
  }

  async archiveEligibleDeploymentLogs() {
    const result = await this.pool.query(
      `select d.id
       from deployments d
       where d.finished_at is not null
         and d.finished_at < now() - ($1::int * interval '1 day')
         and exists (
           select 1
           from deployment_logs l
           where l.deployment_id = d.id
         )
       order by d.finished_at asc
       limit 25`,
      [env.DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS]
    );

    const candidates = result.rows as unknown as ArchiveCandidateRow[];
    let archivedCount = 0;

    await mkdir(env.DEPLOYMENT_LOG_ARCHIVE_DIR, { recursive: true });

    for (const row of candidates) {
      const wasArchived = await this.archiveDeployment(row.id);
      if (wasArchived) {
        archivedCount += 1;
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
        await unlink(archivePath);
      }

      uploadedCount += 1;
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

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      })
    });

    if (!response.ok) {
      throw new Error(`failed to obtain GCS access token: ${response.status}`);
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new Error('failed to obtain GCS access token: missing access_token');
    }

    const expiryMs = Date.now() + (data.expires_in ?? 3600) * 1000;
    this.gcsAccessTokenCache = { token: data.access_token, expiresAt: expiryMs };
    return data.access_token;
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
        lastError = error;

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

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`archive upload failed after retries: ${message}`);
  }

  private async archiveDeployment(deploymentId: string) {
    const archivePath = join(env.DEPLOYMENT_LOG_ARCHIVE_DIR, `${deploymentId}.ndjson.gz`);

    const exists = await this.fileExists(archivePath);
    if (exists) {
      return false;
    }

    const result = await this.pool.query(
      `select id, deployment_id, level, message, timestamp
       from deployment_logs
       where deployment_id = $1
       order by timestamp asc, id asc`,
      [deploymentId]
    );

    const rows = result.rows as unknown as DeploymentLogRow[];
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
      await readFile(path);
      return true;
    } catch {
      return false;
    }
  }

  private async enforceRetentionForDeployment(deploymentId: string) {
    await this.pool.query(
      `delete from deployment_logs
       where deployment_id = $1
         and id in (
           select id
           from deployment_logs
           where deployment_id = $1
           order by timestamp desc, id desc
           offset $2
         )`,
      [deploymentId, env.DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT]
    );
  }
}
