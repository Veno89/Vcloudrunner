import { gzipSync } from 'node:zlib';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { createDeploymentLogArchiveStore } from './archive-store/deployment-log-archive-store.factory.js';
import { createArchiveUploadProvider } from './archive-upload/archive-upload-provider.factory.js';
import type { ArchiveUploadProvider, ArchiveUploadRequest } from './archive-upload/archive-upload-provider.js';
import type { DeploymentLogArchiveStore } from './archive-store/deployment-log-archive-store.js';
import { createIngressManager } from './ingress/ingress-manager.factory.js';
import type { IngressManager } from './ingress/ingress-manager.js';
import { DeploymentStateRepository, type Queryable, type SuccessInput } from './deployment-state.repository.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class DeploymentStateService {
  private readonly repository: DeploymentStateRepository;
  private readonly ingressManager: Pick<IngressManager, 'deleteRoute'>;
  private readonly archiveUploadProvider: ArchiveUploadProvider;
  private readonly archiveStore: DeploymentLogArchiveStore;

  constructor(
    pool?: Queryable,
    ingressManager: Pick<IngressManager, 'deleteRoute'> = createIngressManager(),
    archiveUploadProvider: ArchiveUploadProvider = createArchiveUploadProvider(),
    archiveStore: DeploymentLogArchiveStore = createDeploymentLogArchiveStore()
  ) {
    this.repository = new DeploymentStateRepository(pool);
    this.ingressManager = ingressManager;
    this.archiveUploadProvider = archiveUploadProvider;
    this.archiveStore = archiveStore;
  }

  async markBuilding(deploymentId: string) {
    await this.repository.markBuilding(deploymentId);
  }

  async markRunning(input: SuccessInput) {
    await this.repository.markRunning(input);
  }

  async markFailed(deploymentId: string, message: string) {
    await this.repository.markStatusFailed(deploymentId);
    await this.appendTransitionLogBestEffort({
      deploymentId,
      level: 'error',
      message,
      action: 'failed'
    });
    await this.enforceRetentionBestEffort(deploymentId);
  }

  async markStopped(deploymentId: string, message: string) {
    await this.repository.markStatusStopped(deploymentId);
    await this.appendTransitionLogBestEffort({
      deploymentId,
      level: 'warn',
      message,
      action: 'stopped'
    });
    await this.enforceRetentionBestEffort(deploymentId);
  }

  async isCancellationRequested(deploymentId: string) {
    return this.repository.isCancellationRequested(deploymentId);
  }

  async appendLog(deploymentId: string, message: string, level = 'info') {
    await this.repository.insertLog({ deploymentId, level, message });
    await this.enforceRetentionBestEffort(deploymentId);
  }

  async pruneLogsByRetentionWindow() {
    await this.repository.pruneLogsByRetentionWindow();
  }

  async recoverStuckDeployments() {
    const rows = await this.repository.listStuckDeployments();
    let recoveredCount = 0;

    for (const row of rows) {
      const reason = row.status === 'queued'
        ? `DEPLOYMENT_STUCK_RECOVERY: queued deployment exceeded ${env.DEPLOYMENT_STUCK_QUEUED_MAX_AGE_MINUTES} minutes`
        : `DEPLOYMENT_STUCK_RECOVERY: building deployment exceeded ${env.DEPLOYMENT_STUCK_BUILDING_MAX_AGE_MINUTES} minutes`;

      try {
        await this.markFailed(row.id, reason);
        recoveredCount += 1;
      } catch (error) {
        logger.warn('stuck deployment recovery failed for one deployment', {
          deploymentId: row.id,
          status: row.status,
          message: getErrorMessage(error)
        });
      }
    }

    return recoveredCount;
  }

  async reconcileRunningDeployments(
    isContainerRunning: (containerId: string) => Promise<boolean>
  ) {
    const rows = await this.repository.listRunningDeploymentContainers();
    let reconciledCount = 0;

    for (const row of rows) {
      try {
        const running = await isContainerRunning(row.container_id);
        if (!running) {
          await this.markFailed(
            row.deployment_id,
            'STATE_RECONCILIATION: container not found or not running on worker startup'
          );
          if (row.runtime_url) {
            const host = `${row.project_slug}.${env.PLATFORM_DOMAIN}`;
            try {
              await this.ingressManager.deleteRoute({ host });
            } catch (error) {
              logger.warn('running deployment route cleanup failed during reconciliation', {
                deploymentId: row.deployment_id,
                containerId: row.container_id,
                host,
                message: getErrorMessage(error)
              });
            }
          }
          reconciledCount += 1;
        }
      } catch (error) {
        logger.warn('running deployment reconciliation failed for one deployment', {
          deploymentId: row.deployment_id,
          containerId: row.container_id,
          message: getErrorMessage(error)
        });
      }
    }

    return reconciledCount;
  }

  async archiveEligibleDeploymentLogs() {
    const candidates = await this.repository.listArchivableDeploymentIds();
    let archivedCount = 0;

    await this.archiveStore.ensureArchiveDir();

    for (const deploymentId of candidates) {
      try {
        const wasArchived = await this.archiveDeployment(deploymentId);
        if (wasArchived) {
          archivedCount += 1;
        }
      } catch (error) {
        logger.warn('deployment log archive failed for one deployment', {
          deploymentId,
          message: getErrorMessage(error)
        });
      }
    }

    return archivedCount;
  }

  async uploadPendingArchives() {
    const baseUrl = env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL.trim();
    if (baseUrl.length === 0) {
      return 0;
    }

    await this.archiveStore.ensureArchiveDir();
    const candidates = await this.archiveStore.listUploadCandidates();

    let uploadedCount = 0;

    for (const candidate of candidates) {
      try {
        const payload = await this.archiveStore.readArchivePayload(candidate);
        const uploadRequest = await this.createArchiveUploadRequest({
          fileName: candidate.fileName,
          baseUrl,
          payload
        });

        await this.uploadArchiveWithRetry({
          targetUrl: uploadRequest.targetUrl,
          payload,
          headers: uploadRequest.headers
        });

        await this.archiveStore.markUploaded(candidate, uploadRequest.targetUrl);

        if (env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD) {
          try {
            await this.archiveStore.deleteArchive(candidate);
          } catch (error) {
            logger.warn('deployment log archive local cleanup failed after upload', {
              fileName: candidate.fileName,
              archivePath: candidate.archivePath,
              message: getErrorMessage(error)
            });
          }
        }

        uploadedCount += 1;
      } catch (error) {
        logger.warn('deployment log archive upload failed for one artifact', {
          fileName: candidate.fileName,
          archivePath: candidate.archivePath,
          message: getErrorMessage(error)
        });
      }
    }

    return uploadedCount;
  }

  async cleanupArchivedArtifacts() {
    await this.archiveStore.ensureArchiveDir();

    const now = Date.now();
    const archiveMaxAgeMs = env.DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const markerMaxAgeMs = env.DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const candidates = await this.archiveStore.listCleanupCandidates({
      nowMs: now,
      archiveMaxAgeMs,
      markerMaxAgeMs
    });

    let deletedCount = 0;

    for (const candidate of candidates) {
      try {
        await this.archiveStore.deleteCleanupCandidate(candidate);
        deletedCount += 1;
      } catch (error) {
        logger.warn('deployment log archive cleanup failed for one artifact', {
          fileName: candidate.fileName,
          filePath: candidate.filePath,
          message: getErrorMessage(error)
        });
      }
    }

    return deletedCount;
  }

  async createArchiveUploadRequest(input: { fileName: string; baseUrl: string; payload: Buffer }): Promise<ArchiveUploadRequest> {
    return this.archiveUploadProvider.createUploadRequest(input);
  }

  private async uploadArchiveWithRetry(input: { targetUrl: string; payload: Buffer; headers: Record<string, string> }) {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS);

      try {
        const response = await fetch(input.targetUrl, {
          method: 'PUT',
          headers: input.headers,
          body: new Uint8Array(input.payload),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`archive upload failed with status ${response.status}`);
        }

        return;
      } catch (error) {
        lastError = controller.signal.aborted
          ? new Error(`archive upload timed out after ${env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS}ms`)
          : new Error(`archive upload request failed: ${getErrorMessage(error)}`);

        if (attempt === env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS) {
          break;
        }

        const backoff = Math.min(
          env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS * 2 ** (attempt - 1),
          env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS
        );
        await sleep(backoff);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const message = getErrorMessage(lastError);
    throw new Error(`archive upload failed after retries: ${message}`);
  }

  private async archiveDeployment(deploymentId: string) {
    const rows = await this.repository.listDeploymentLogsByDeployment(deploymentId);
    if (rows.length === 0) {
      return false;
    }

    const ndjson =
      rows
        .map((item) =>
          JSON.stringify({
            id: item.id,
            deploymentId: item.deployment_id,
            level: item.level,
            message: item.message,
            timestamp: item.timestamp
          })
        )
        .join('\n') + '\n';

    const compressed = gzipSync(ndjson);
    return this.archiveStore.writeArchiveIfMissing(deploymentId, compressed);
  }

  private async enforceRetentionBestEffort(deploymentId: string) {
    try {
      await this.repository.enforceRetentionForDeployment(deploymentId);
    } catch (error) {
      logger.warn('deployment log retention enforcement failed after write', {
        deploymentId,
        message: getErrorMessage(error)
      });
    }
  }

  private async appendTransitionLogBestEffort(input: {
    deploymentId: string;
    level: string;
    message: string;
    action: 'failed' | 'stopped';
  }) {
    try {
      await this.repository.insertLog({
        deploymentId: input.deploymentId,
        level: input.level,
        message: input.message
      });
    } catch (error) {
      logger.warn(`deployment ${input.action} log insert failed after status update`, {
        deploymentId: input.deploymentId,
        message: getErrorMessage(error)
      });
    }
  }
}
