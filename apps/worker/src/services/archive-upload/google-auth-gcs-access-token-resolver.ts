import { JWT, type JWTOptions } from 'google-auth-library';

import { env } from '../../config/env.js';
import { getErrorMessage, normalizePrivateKey } from './archive-upload-provider.shared.js';
import type { GcsAccessTokenResolver } from './gcs-access-token-resolver.js';

const GCS_STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

type JwtLike = Pick<JWT, 'authorize'>;

export class GoogleAuthGcsAccessTokenResolver implements GcsAccessTokenResolver {
  private jwtClient: JwtLike | null = null;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly createJwtClient: (options: JWTOptions) => JwtLike = (options) => new JWT(options)
  ) {}

  async resolveAccessToken() {
    const staticToken = env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN.trim();
    if (staticToken.length > 0) {
      return staticToken;
    }

    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60_000) {
      return this.cachedToken.token;
    }

    const clientEmail = env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL.trim();
    const privateKey = normalizePrivateKey(env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY.trim());
    if (clientEmail.length === 0 || privateKey.length === 0) {
      throw new Error(
        'missing GCS credentials: set DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN or service-account email/private key'
      );
    }

    const jwtClient =
      this.jwtClient ??
      (this.jwtClient = this.createJwtClient({
        email: clientEmail,
        key: privateKey,
        scopes: [GCS_STORAGE_SCOPE]
      }));

    let credentials: { access_token?: string | null; expiry_date?: number | null };
    try {
      credentials = await jwtClient.authorize();
    } catch (error) {
      throw new Error(`failed to obtain GCS access token: request failed: ${getErrorMessage(error)}`);
    }

    const normalizedToken = credentials.access_token?.trim();
    if (!normalizedToken) {
      throw new Error('failed to obtain GCS access token: missing access_token');
    }

    const expiresAt =
      typeof credentials.expiry_date === 'number' && Number.isFinite(credentials.expiry_date)
        ? credentials.expiry_date
        : Date.now() + 3600 * 1000;
    this.cachedToken = { token: normalizedToken, expiresAt };

    return normalizedToken;
  }
}
