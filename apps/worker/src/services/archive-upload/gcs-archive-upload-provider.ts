import { env } from '../../config/env.js';
import type { ArchiveUploadProvider } from './archive-upload-provider.js';
import {
  encodeObjectKey,
  encodePathSegment,
  getErrorMessage,
  joinObjectKey,
  normalizePrivateKey,
  signJwtAssertion
} from './archive-upload-provider.shared.js';

export class GcsArchiveUploadProvider implements ArchiveUploadProvider {
  private gcsAccessTokenCache: { token: string; expiresAt: number } | null = null;

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }) {
    const bucket = env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET.trim();
    if (bucket.length === 0) {
      throw new Error('missing DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET for gcs provider');
    }

    const key = joinObjectKey(env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX, input.fileName);
    const targetUrl =
      `${input.baseUrl.replace(/\/$/, '')}/${encodePathSegment(bucket)}/${encodeObjectKey(key)}`;
    const token = await this.resolveGcsAccessToken();

    return {
      targetUrl,
      headers: {
        'content-type': 'application/gzip',
        authorization: `Bearer ${token}`
      }
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
      throw new Error(
        'missing GCS credentials: set DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN or service-account email/private key'
      );
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
    const assertion = `${unsignedToken}.${signJwtAssertion({ unsignedToken, privateKey })}`;

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
}
