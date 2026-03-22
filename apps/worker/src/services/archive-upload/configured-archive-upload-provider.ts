import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, ArchiveUploadProviders } from './archive-upload-provider.js';

export class ConfiguredArchiveUploadProvider implements ArchiveUploadProvider {
  constructor(private readonly providers: ArchiveUploadProviders) {}

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }) {
    return this.providers[env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER].createUploadRequest(input);
  }
}
