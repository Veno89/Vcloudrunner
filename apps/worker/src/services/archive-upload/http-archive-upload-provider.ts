import { env } from '../../config/env.js';
import type { ArchiveUploadProvider, HttpArchiveUploadRequest } from './archive-upload-provider.js';

export class HttpArchiveUploadProvider implements ArchiveUploadProvider {
  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<HttpArchiveUploadRequest> {
    const targetUrl = `${input.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(input.fileName)}`;

    return {
      provider: 'http',
      transport: 'http',
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
