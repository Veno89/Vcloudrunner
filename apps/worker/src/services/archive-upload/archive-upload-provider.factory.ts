import { createConfiguredArchiveUploadProvider } from './configured-archive-upload-provider.factory.js';
import type { ArchiveUploadProvider } from './archive-upload-provider.js';

export function createArchiveUploadProvider(): ArchiveUploadProvider {
  return createConfiguredArchiveUploadProvider();
}
