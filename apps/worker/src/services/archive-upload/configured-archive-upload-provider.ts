import { createHash, createHmac, createSign } from 'node:crypto';

import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, ArchiveUploadRequest } from './archive-upload-provider.js';

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

export class ConfiguredArchiveUploadProvider implements ArchiveUploadProvider {
  private gcsAccessTokenCache: { token: string; expiresAt: number } | null = null;

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<ArchiveUploadRequest> {
    const targetUrl = this.buildArchiveUploadTargetUrl({
      fileName: input.fileName,
      baseUrl: input.baseUrl
    });

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
}
