import { createArchiveUploadProviders } from './archive-upload-provider.registry.js';
import { ConfiguredArchiveUploadProvider } from './configured-archive-upload-provider.js';

export function createConfiguredArchiveUploadProvider() {
  return new ConfiguredArchiveUploadProvider(createArchiveUploadProviders());
}
