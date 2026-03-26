import type { GcsAccessTokenResolver } from './gcs-access-token-resolver.js';
import { GoogleAuthGcsAccessTokenResolver } from './google-auth-gcs-access-token-resolver.js';

export function createGcsAccessTokenResolver(): GcsAccessTokenResolver {
  return new GoogleAuthGcsAccessTokenResolver();
}
