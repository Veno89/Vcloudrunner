export interface DeploymentLogArchiveUploadCandidate {
  fileName: string;
  archivePath: string;
  markerPath: string;
}

export interface DeploymentLogArchiveCleanupCandidate {
  fileName: string;
  filePath: string;
}

export interface DeploymentLogArchiveStore {
  ensureArchiveDir(): Promise<void>;
  writeArchiveIfMissing(deploymentId: string, payload: Buffer): Promise<boolean>;
  listUploadCandidates(): Promise<DeploymentLogArchiveUploadCandidate[]>;
  readArchivePayload(candidate: DeploymentLogArchiveUploadCandidate): Promise<Buffer>;
  markUploaded(candidate: DeploymentLogArchiveUploadCandidate, targetUrl: string): Promise<void>;
  deleteArchive(candidate: DeploymentLogArchiveUploadCandidate): Promise<void>;
  listCleanupCandidates(input: {
    nowMs: number;
    archiveMaxAgeMs: number;
    markerMaxAgeMs: number;
  }): Promise<DeploymentLogArchiveCleanupCandidate[]>;
  deleteCleanupCandidate(candidate: DeploymentLogArchiveCleanupCandidate): Promise<void>;
}
