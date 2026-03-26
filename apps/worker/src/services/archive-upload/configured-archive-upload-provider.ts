import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, ArchiveUploadProviders, NativeArchiveUploadRequest } from './archive-upload-provider.js';

export class ConfiguredArchiveUploadProvider implements ArchiveUploadProvider {
  constructor(private readonly providers: ArchiveUploadProviders) {}

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }) {
    return this.providers[env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER].createUploadRequest(input);
  }

  async uploadNative(input: {
    request: NativeArchiveUploadRequest;
    payload: Buffer;
    signal: AbortSignal;
  }) {
    const provider = this.providers[input.request.provider];
    if (!provider.uploadNative) {
      throw new Error(`archive upload provider ${input.request.provider} does not support native uploads`);
    }

    await provider.uploadNative(input);
  }
}
