import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { env } from '../../config/env.js';
import type {
  DeploymentLogArchiveCleanupCandidate,
  DeploymentLogArchiveStore,
  DeploymentLogArchiveUploadCandidate
} from './deployment-log-archive-store.js';

export class LocalDeploymentLogArchiveStore implements DeploymentLogArchiveStore {
  constructor(private readonly archiveDir = env.DEPLOYMENT_LOG_ARCHIVE_DIR) {}

  async ensureArchiveDir(): Promise<void> {
    await mkdir(this.archiveDir, { recursive: true });
  }

  async writeArchiveIfMissing(deploymentId: string, payload: Buffer): Promise<boolean> {
    const archivePath = this.getArchivePath(deploymentId);

    if (await this.pathExists(archivePath)) {
      return false;
    }

    await writeFile(archivePath, payload);
    return true;
  }

  async listUploadCandidates(): Promise<DeploymentLogArchiveUploadCandidate[]> {
    const entries = await readdir(this.archiveDir);
    const candidates: DeploymentLogArchiveUploadCandidate[] = [];

    for (const fileName of entries) {
      if (!fileName.endsWith('.ndjson.gz')) {
        continue;
      }

      const archivePath = join(this.archiveDir, fileName);
      const markerPath = `${archivePath}.uploaded`;

      if (await this.pathExists(markerPath)) {
        continue;
      }

      candidates.push({
        fileName,
        archivePath,
        markerPath
      });
    }

    return candidates;
  }

  async readArchivePayload(candidate: DeploymentLogArchiveUploadCandidate): Promise<Buffer> {
    return readFile(candidate.archivePath);
  }

  async markUploaded(
    candidate: DeploymentLogArchiveUploadCandidate,
    targetUrl: string
  ): Promise<void> {
    await writeFile(
      candidate.markerPath,
      JSON.stringify({ uploadedAt: new Date().toISOString(), targetUrl })
    );
  }

  async deleteArchive(candidate: DeploymentLogArchiveUploadCandidate): Promise<void> {
    await unlink(candidate.archivePath);
  }

  async listCleanupCandidates(input: {
    nowMs: number;
    archiveMaxAgeMs: number;
    markerMaxAgeMs: number;
  }): Promise<DeploymentLogArchiveCleanupCandidate[]> {
    const entries = await readdir(this.archiveDir);
    const candidates: DeploymentLogArchiveCleanupCandidate[] = [];

    for (const fileName of entries) {
      if (!fileName.endsWith('.ndjson.gz') && !fileName.endsWith('.ndjson.gz.uploaded')) {
        continue;
      }

      const filePath = join(this.archiveDir, fileName);
      const info = await stat(filePath);
      const ageMs = input.nowMs - info.mtimeMs;

      if (fileName.endsWith('.ndjson.gz.uploaded')) {
        if (ageMs > input.markerMaxAgeMs) {
          candidates.push({ fileName, filePath });
        }
        continue;
      }

      const markerPath = `${filePath}.uploaded`;
      const hasMarker = await this.pathExists(markerPath);

      if (hasMarker && ageMs > input.archiveMaxAgeMs) {
        candidates.push({ fileName, filePath });
      }
    }

    return candidates;
  }

  async deleteCleanupCandidate(candidate: DeploymentLogArchiveCleanupCandidate): Promise<void> {
    await unlink(candidate.filePath);
  }

  private getArchivePath(deploymentId: string) {
    return join(this.archiveDir, `${deploymentId}.ndjson.gz`);
  }

  private async pathExists(path: string) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
