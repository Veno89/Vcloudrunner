import { createGcsAccessTokenResolver } from './gcs-access-token-resolver.factory.js';
import { GcsArchiveUploadProvider } from './gcs-archive-upload-provider.js';

export function createGcsArchiveUploadProvider() {
  return new GcsArchiveUploadProvider(createGcsAccessTokenResolver());
}
