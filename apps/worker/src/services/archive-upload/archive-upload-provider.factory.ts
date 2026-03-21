import { ConfiguredArchiveUploadProvider } from './configured-archive-upload-provider.js';
import type { ArchiveUploadProvider } from './archive-upload-provider.js';

export function createArchiveUploadProvider(): ArchiveUploadProvider {
  return new ConfiguredArchiveUploadProvider();
}
