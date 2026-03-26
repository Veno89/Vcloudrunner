import type { ArchiveUploadProvider } from './archive-upload-provider.js';
import { HttpArchiveUploadProvider } from './http-archive-upload-provider.js';

export type HttpArchiveUploadProviderConstructor = new () => ArchiveUploadProvider;

interface CreateHttpArchiveUploadProviderOptions {
  ProviderClass?: HttpArchiveUploadProviderConstructor;
}

export function createHttpArchiveUploadProvider(
  options: CreateHttpArchiveUploadProviderOptions = {}
): ArchiveUploadProvider {
  const ProviderClass = options.ProviderClass ?? HttpArchiveUploadProvider;
  return new ProviderClass();
}
