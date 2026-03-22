import { env } from '../../config/env.js';
import type { ArchiveUploadProvider } from './archive-upload-provider.js';

export class HttpArchiveUploadProvider implements ArchiveUploadProvider {
  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }) {
    const targetUrl = `${input.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(input.fileName)}`;

    return {
      targetUrl,
      headers: {
        'content-type': 'application/gzip',
        ...(env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN
          ? { authorization: `Bearer ${env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN}` }
          : {})
      }
    };
  }
}
