import { fetchJson, postJson, putJson, deleteRequest } from './client';
import type { ApiDataResponse, ApiProjectDatabase } from './types';

export async function fetchProjectDatabases(projectId: string): Promise<ApiProjectDatabase[]> {
  const response = await fetchJson<ApiDataResponse<ApiProjectDatabase[]>>(
    `/v1/projects/${projectId}/databases`
  );

  return response.data;
}

export async function createProjectDatabase(
  projectId: string,
  input: {
    name: string;
    serviceNames: string[];
  }
): Promise<ApiProjectDatabase> {
  const response = await postJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases`,
    {
      name: input.name,
      serviceNames: input.serviceNames
    }
  );

  return response.data;
}

export async function reconcileProjectDatabase(
  projectId: string,
  databaseId: string
): Promise<ApiProjectDatabase> {
  const response = await postJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/reconcile`,
    {}
  );

  return response.data;
}

export async function rotateProjectDatabaseCredentials(
  projectId: string,
  databaseId: string
): Promise<ApiProjectDatabase> {
  const response = await postJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/rotate-credentials`,
    {}
  );

  return response.data;
}

export async function updateProjectDatabaseBackupPolicy(
  projectId: string,
  databaseId: string,
  input: {
    backupMode: 'none' | 'external';
    backupSchedule: 'daily' | 'weekly' | 'monthly' | 'custom' | null;
    backupRunbook: string;
  }
): Promise<ApiProjectDatabase> {
  const response = await putJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/backup-policy`,
    input
  );

  return response.data;
}

export async function recordProjectDatabaseRecoveryCheck(
  projectId: string,
  databaseId: string,
  input: {
    kind: 'backup' | 'restore';
    status?: 'succeeded' | 'failed';
    summary?: string;
    detail?: string;
  }
): Promise<ApiProjectDatabase> {
  const response = await postJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/recovery-checks`,
    input
  );

  return response.data;
}

export async function recordProjectDatabaseBackupArtifact(
  projectId: string,
  databaseId: string,
  input: {
    label: string;
    storageProvider: 's3' | 'gcs' | 'azure' | 'local' | 'other';
    location: string;
    sizeBytes?: number | null;
    producedAt: string;
    retentionExpiresAt?: string | null;
    integrityStatus?: 'unknown' | 'verified' | 'failed';
    detail?: string;
  }
): Promise<ApiProjectDatabase> {
  const response = await postJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/backup-artifacts`,
    {
      label: input.label,
      storageProvider: input.storageProvider,
      location: input.location,
      sizeBytes: input.sizeBytes ?? null,
      producedAt: input.producedAt,
      retentionExpiresAt: input.retentionExpiresAt ?? null,
      integrityStatus: input.integrityStatus ?? 'unknown',
      detail: input.detail ?? ''
    }
  );

  return response.data;
}

export async function updateProjectDatabaseBackupArtifact(
  projectId: string,
  databaseId: string,
  backupArtifactId: string,
  input: {
    integrityStatus: 'unknown' | 'verified' | 'failed';
    lifecycleStatus: 'active' | 'archived' | 'purged';
    retentionExpiresAt?: string | null;
    detail?: string;
  }
): Promise<ApiProjectDatabase> {
  const response = await putJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/backup-artifacts/${backupArtifactId}`,
    {
      integrityStatus: input.integrityStatus,
      lifecycleStatus: input.lifecycleStatus,
      retentionExpiresAt: input.retentionExpiresAt ?? null,
      detail: input.detail ?? ''
    }
  );

  return response.data;
}

export async function createProjectDatabaseRestoreRequest(
  projectId: string,
  databaseId: string,
  input: {
    backupArtifactId?: string | null;
    target: string;
    summary: string;
    detail?: string;
  }
): Promise<ApiProjectDatabase> {
  const response = await postJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/restore-requests`,
    {
      backupArtifactId: input.backupArtifactId ?? null,
      target: input.target,
      summary: input.summary,
      detail: input.detail ?? ''
    }
  );

  return response.data;
}

export async function reviewProjectDatabaseRestoreRequest(
  projectId: string,
  databaseId: string,
  restoreRequestId: string,
  input: {
    approvalStatus: 'approved' | 'rejected';
    approvalDetail?: string;
  }
): Promise<ApiProjectDatabase> {
  const response = await putJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/restore-requests/${restoreRequestId}/approval`,
    {
      approvalStatus: input.approvalStatus,
      approvalDetail: input.approvalDetail ?? ''
    }
  );

  return response.data;
}

export async function updateProjectDatabaseRestoreRequest(
  projectId: string,
  databaseId: string,
  restoreRequestId: string,
  input: {
    status: 'requested' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled';
    detail?: string;
  }
): Promise<ApiProjectDatabase> {
  const response = await putJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/restore-requests/${restoreRequestId}`,
    {
      status: input.status,
      detail: input.detail ?? ''
    }
  );

  return response.data;
}

export async function updateProjectDatabaseServiceLinks(
  projectId: string,
  databaseId: string,
  input: {
    serviceNames: string[];
  }
): Promise<ApiProjectDatabase> {
  const response = await putJson<ApiDataResponse<ApiProjectDatabase>>(
    `/v1/projects/${projectId}/databases/${databaseId}/service-links`,
    {
      serviceNames: input.serviceNames
    }
  );

  return response.data;
}

export async function removeProjectDatabase(projectId: string, databaseId: string): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/databases/${databaseId}`);
}
