import { cache } from 'react';
import { getDashboardRequestAuth, type DashboardRequestAuth } from './dashboard-session';

import type {
  DeploymentStatus,
  ProjectServiceDefinition,
  ProjectServiceExposure,
  ProjectServiceKind
} from '@vcloudrunner/shared-types';

export interface ApiProject {
  id: string;
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch: string;
  services: ProjectServiceDefinition[];
}

export interface ApiProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ApiProjectInvitation {
  id: string;
  projectId: string;
  email: string;
  claimToken: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'cancelled';
  invitedBy: string | null;
  acceptedBy: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  invitedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  acceptedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ApiProjectInvitationClaim extends ApiProjectInvitation {
  projectName: string;
  projectSlug: string;
}

export interface ApiProjectInvitationDelivery {
  status: 'disabled' | 'delivered' | 'failed';
  message: string;
  claimUrl: string;
  attemptedAt: string;
}

export type ApiProjectInviteResult =
  | {
      kind: 'member';
      member: ApiProjectMember;
    }
  | {
      kind: 'invitation';
      invitation: ApiProjectInvitation;
      delivery: ApiProjectInvitationDelivery;
    };

export interface ApiProjectInvitationRedeliveryResult {
  invitation: ApiProjectInvitation;
  delivery: ApiProjectInvitationDelivery;
}

export interface ApiProjectDomainEvent {
  id: string;
  projectId: string;
  domainId: string;
  kind:
    | 'ownership'
    | 'tls'
    | 'certificate'
    | 'certificate_trust'
    | 'certificate_path_validity'
    | 'certificate_identity'
    | 'certificate_attention'
    | 'certificate_chain';
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: string;
}

export interface ApiProjectDomain {
  id: string;
  projectId: string;
  deploymentId: string | null;
  host: string;
  targetPort: number;
  createdAt: string;
  updatedAt: string;
  deploymentStatus: DeploymentStatus | null;
  runtimeUrl: string | null;
  serviceName: string | null;
  serviceKind: ProjectServiceKind | null;
  serviceExposure: ProjectServiceExposure | null;
  routeStatus: 'active' | 'degraded' | 'stale' | 'pending';
  statusDetail: string;
  verificationStatus?: 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
  verificationDetail?: string;
  verificationCheckedAt?: string | null;
  verificationStatusChangedAt?: string | null;
  verificationVerifiedAt?: string | null;
  ownershipStatus?: 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
  ownershipDetail?: string;
  tlsStatus?: 'ready' | 'pending' | 'invalid' | 'unknown';
  tlsDetail?: string;
  certificateState?:
    | 'managed'
    | 'awaiting-route'
    | 'awaiting-dns'
    | 'provisioning'
    | 'active'
    | 'issuance-attention'
    | 'renewal-attention'
    | 'check-unavailable';
  certificateTitle?: string;
  certificateDetail?: string;
  certificateValidFrom?: string | null;
  certificateValidTo?: string | null;
  certificateSubjectName?: string | null;
  certificateIssuerName?: string | null;
  certificateSubjectAltNames?: string[];
  certificateChainSubjects?: string[];
  certificateChainEntries?: Array<{
    subjectName: string | null;
    issuerName: string | null;
    fingerprintSha256: string | null;
    serialNumber: string | null;
    isSelfIssued: boolean;
    validFrom?: string | null;
    validTo?: string | null;
  }>;
  certificateIntermediateSubjectNames?: string[];
  certificateChainDepth?: number;
  certificateRootSubjectName?: string | null;
  certificateChainChangedAt?: string | null;
  certificateChainObservedCount?: number;
  certificateChainLastHealthyAt?: string | null;
  certificateLastHealthyChainEntries?: Array<{
    subjectName: string | null;
    issuerName: string | null;
    fingerprintSha256: string | null;
    serialNumber: string | null;
    isSelfIssued: boolean;
    validFrom?: string | null;
    validTo?: string | null;
  }>;
  certificateLastHealthyIntermediateSubjectNames?: string[];
  certificateLastHealthyChainDepth?: number;
  certificatePathValidityStatus?:
    | 'valid'
    | 'expiring-soon'
    | 'expired'
    | 'not-yet-valid'
    | 'unavailable';
  certificatePathValidityTitle?: string;
  certificatePathValidityDetail?: string;
  certificatePathValidityChangedAt?: string | null;
  certificatePathValidityObservedCount?: number;
  certificatePathValidityLastHealthyAt?: string | null;
  certificateValidationReason?:
    | 'self-signed'
    | 'hostname-mismatch'
    | 'issuer-untrusted'
    | 'expired'
    | 'not-yet-valid'
    | 'validation-failed'
    | null;
  certificateFingerprintSha256?: string | null;
  certificateSerialNumber?: string | null;
  certificateFirstObservedAt?: string | null;
  certificateChangedAt?: string | null;
  certificateLastRotatedAt?: string | null;
  certificateValidityStatus?:
    | 'valid'
    | 'expiring-soon'
    | 'expired'
    | 'not-yet-valid'
    | 'unavailable';
  certificateValidityDetail?: string;
  certificateTrustStatus?:
    | 'trusted'
    | 'date-invalid'
    | 'hostname-mismatch'
    | 'self-signed'
    | 'issuer-untrusted'
    | 'validation-failed'
    | 'unavailable';
  certificateTrustDetail?: string;
  certificateIdentityStatus?:
    | 'unavailable'
    | 'first-observed'
    | 'stable'
    | 'rotated'
    | 'rotated-attention';
  certificateIdentityTitle?: string;
  certificateIdentityDetail?: string;
  certificateGuidanceState?:
    | 'healthy'
    | 'wait-for-route'
    | 'wait-for-dns'
    | 'wait-for-issuance'
    | 'renew-soon'
    | 'renew-now'
    | 'fix-coverage'
    | 'fix-trust'
    | 'refresh-checks';
  certificateGuidanceTitle?: string;
  certificateGuidanceDetail?: string;
  certificateGuidanceChangedAt?: string | null;
  certificateGuidanceObservedCount?: number;
  certificateAttentionStatus?:
    | 'healthy'
    | 'monitor'
    | 'action-needed'
    | 'persistent-action-needed';
  certificateAttentionTitle?: string;
  certificateAttentionDetail?: string;
  certificateChainStatus?:
    | 'unavailable'
    | 'leaf-only'
    | 'chained'
    | 'incomplete'
    | 'private-root'
    | 'self-signed-leaf';
  certificateChainTitle?: string;
  certificateChainDetail?: string;
  certificateChainAttentionStatus?:
    | 'healthy'
    | 'monitor'
    | 'action-needed'
    | 'persistent-action-needed';
  certificateChainAttentionTitle?: string;
  certificateChainAttentionDetail?: string;
  certificateChainHistoryStatus?:
    | 'unavailable'
    | 'baseline-missing'
    | 'stable'
    | 'rotated'
    | 'degraded'
    | 'drifted';
  certificateChainHistoryTitle?: string;
  certificateChainHistoryDetail?: string;
  diagnosticsCheckedAt?: string | null;
  diagnosticsFreshnessStatus?: 'fresh' | 'stale' | 'unchecked';
  diagnosticsFreshnessDetail?: string;
  claimState?:
    | 'managed'
    | 'publish-verification-record'
    | 'fix-verification-record'
    | 'configure-dns'
    | 'fix-dns'
    | 'refresh-checks'
    | 'redeploy-public-service'
    | 'wait-for-https'
    | 'review-https'
    | 'healthy';
  claimTitle?: string;
  claimDetail?: string;
  claimDnsRecordType?: 'CNAME' | 'TXT' | null;
  claimDnsRecordName?: string | null;
  claimDnsRecordValue?: string | null;
  verificationDnsRecordType?: 'TXT' | null;
  verificationDnsRecordName?: string | null;
  verificationDnsRecordValue?: string | null;
  routingDnsRecordType?: 'CNAME' | null;
  routingDnsRecordName?: string | null;
  routingDnsRecordValue?: string | null;
  certificateHistorySummary?: {
    eventCount: number;
    incidentCount: number;
    recoveryCount: number;
    trustIncidentCount: number;
    pathWarningCount: number;
    pathIncidentCount: number;
    chainIncidentCount: number;
    attentionIncidentCount: number;
    lastEventAt: string | null;
    lastIncidentAt: string | null;
    lastIncidentKind:
      | 'certificate_attention'
      | 'certificate_chain'
      | 'certificate_trust'
      | 'certificate_path_validity'
      | null;
    lastRecoveryAt: string | null;
    lastRecoveryKind:
      | 'certificate_attention'
      | 'certificate_chain'
      | 'certificate_trust'
      | 'certificate_path_validity'
      | null;
    lastPathWarningAt: string | null;
  };
  ownershipStatusChangedAt?: string | null;
  tlsStatusChangedAt?: string | null;
  ownershipVerifiedAt?: string | null;
  tlsReadyAt?: string | null;
  recentEvents?: ApiProjectDomainEvent[];
}

export interface ApiProjectDatabase {
  id: string;
  projectId: string;
  engine: 'postgres';
  name: string;
  status: 'pending_config' | 'provisioning' | 'ready' | 'failed';
  statusDetail: string;
  databaseName: string;
  username: string;
  password: string;
  connectionHost: string | null;
  connectionPort: number | null;
  connectionSslMode: 'disable' | 'prefer' | 'require' | null;
  healthStatus: 'unknown' | 'healthy' | 'unreachable' | 'credentials_invalid' | 'failing';
  healthStatusDetail: string;
  healthStatusChangedAt: string | null;
  lastHealthCheckAt: string | null;
  lastHealthyAt: string | null;
  lastHealthErrorAt: string | null;
  consecutiveHealthCheckFailures: number;
  credentialsRotatedAt: string | null;
  connectionString: string | null;
  provisionedAt: string | null;
  lastProvisioningAttemptAt: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
  serviceNames: string[];
  generatedEnvironment: {
    prefix: string;
    databaseUrlKey: string;
    hostKey: string;
    portKey: string;
    databaseNameKey: string;
    usernameKey: string;
    passwordKey: string;
  };
}

export interface ApiDeployment {
  id: string;
  projectId: string;
  serviceName?: string | null;
  status: DeploymentStatus;
  commitSha: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  runtimeUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ApiQueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  prioritized: number;
}

export interface ApiQueueHealth {
  status: 'ok' | 'degraded' | 'unavailable';
  redis?: string;
  queue?: string;
  counts?: ApiQueueCounts;
  sampledAt?: string;
  message?: string;
}

export interface ApiWorkerHealth {
  status: 'ok' | 'stale' | 'unavailable';
  heartbeatKey?: string;
  staleAfterMs?: number;
  ageMs?: number;
  timestamp?: string;
  service?: string;
  pid?: number | null;
  message?: string;
}

export interface ApiServiceHealth {
  status: 'ok' | 'unavailable';
  message?: string;
}

export interface ApiEnvironmentVariable {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface ApiDeploymentLog {
  id: string;
  deploymentId: string;
  level: string;
  message: string;
  timestamp: string;
}

export interface ApiTokenRecord {
  id: string;
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tokenPreview: string;
}

export interface CreatedApiTokenRecord {
  id: string;
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  token: string;
}

export type ApiViewerAuthSource =
  | 'database-token'
  | 'bootstrap-token'
  | 'dev-user-header'
  | 'dev-admin-token';

export interface ApiViewerContext {
  userId: string;
  role: 'admin' | 'user';
  scopes: string[];
  authSource: ApiViewerAuthSource;
  authMode: 'token' | 'development';
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  acceptedProjectInvitations?: Array<{
    projectId: string;
    projectName: string;
    role: 'viewer' | 'editor' | 'admin';
  }>;
}

interface ApiDataResponse<T> {
  data: T;
}

interface ViewerContextFetchResult {
  viewer: ApiViewerContext | null;
  statusCode: number | null;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
const apiAuthToken = process.env.API_AUTH_TOKEN;
const DASHBOARD_API_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeQueueHealthPayload(
  payload: unknown,
  fallbackMessage: string
): ApiQueueHealth {
  if (!isRecord(payload)) {
    return {
      status: 'unavailable',
      message: fallbackMessage
    };
  }

  const status =
    payload.status === 'ok' || payload.status === 'degraded' || payload.status === 'unavailable'
      ? payload.status
      : 'unavailable';

  const counts = isRecord(payload.counts)
    ? {
        waiting: typeof payload.counts.waiting === 'number' ? payload.counts.waiting : 0,
        active: typeof payload.counts.active === 'number' ? payload.counts.active : 0,
        completed: typeof payload.counts.completed === 'number' ? payload.counts.completed : 0,
        failed: typeof payload.counts.failed === 'number' ? payload.counts.failed : 0,
        delayed: typeof payload.counts.delayed === 'number' ? payload.counts.delayed : 0,
        paused: typeof payload.counts.paused === 'number' ? payload.counts.paused : 0,
        prioritized: typeof payload.counts.prioritized === 'number' ? payload.counts.prioritized : 0
      }
    : undefined;

  return {
    status,
    ...(typeof payload.redis === 'string' ? { redis: payload.redis } : {}),
    ...(typeof payload.queue === 'string' ? { queue: payload.queue } : {}),
    ...(counts ? { counts } : {}),
    ...(typeof payload.sampledAt === 'string' ? { sampledAt: payload.sampledAt } : {}),
    message: typeof payload.message === 'string' ? payload.message : fallbackMessage
  };
}

function normalizeWorkerHealthPayload(
  payload: unknown,
  fallbackMessage: string
): ApiWorkerHealth {
  if (!isRecord(payload)) {
    return {
      status: 'unavailable',
      message: fallbackMessage
    };
  }

  const status =
    payload.status === 'ok' || payload.status === 'stale' || payload.status === 'unavailable'
      ? payload.status
      : 'unavailable';

  return {
    status,
    ...(typeof payload.heartbeatKey === 'string' ? { heartbeatKey: payload.heartbeatKey } : {}),
    ...(typeof payload.staleAfterMs === 'number' ? { staleAfterMs: payload.staleAfterMs } : {}),
    ...(typeof payload.ageMs === 'number' ? { ageMs: payload.ageMs } : {}),
    ...(typeof payload.timestamp === 'string' ? { timestamp: payload.timestamp } : {}),
    ...(typeof payload.service === 'string' ? { service: payload.service } : {}),
    ...(typeof payload.pid === 'number' || payload.pid === null ? { pid: payload.pid } : {}),
    message: typeof payload.message === 'string' ? payload.message : fallbackMessage
  };
}

function buildAuthHeaders(
  auth: Pick<DashboardRequestAuth, 'bearerToken' | 'demoUserId'>,
  extra?: Record<string, string>
): Record<string, string> {
  const headers = extra ? { ...extra } : {};

  if (auth.bearerToken) {
    headers.authorization = `Bearer ${auth.bearerToken}`;
  }

  if (auth.demoUserId) {
    headers['x-user-id'] = auth.demoUserId;
  }

  return headers;
}

export function buildDashboardAuthHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  return buildAuthHeaders(getDashboardRequestAuth(), extra);
}

async function requestApi(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DASHBOARD_API_TIMEOUT_MS);

  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      cache: 'no-store',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    throw controller.signal.aborted
      ? new Error(`API request timed out after ${DASHBOARD_API_TIMEOUT_MS}ms`)
      : new Error(getErrorMessage(error));
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await requestApi(path, {
    headers: buildDashboardAuthHeaders()
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await requestApi(path, {
    method: 'POST',
    headers: buildDashboardAuthHeaders({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function putJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await requestApi(path, {
    method: 'PUT',
    headers: buildDashboardAuthHeaders({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function deleteRequest(path: string): Promise<void> {
  const response = await requestApi(path, {
    method: 'DELETE',
    headers: buildDashboardAuthHeaders()
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }
}

export async function fetchDeploymentsForProject(projectId: string): Promise<ApiDeployment[]> {
  const response = await fetchJson<ApiDataResponse<ApiDeployment[]>>(
    `/v1/projects/${projectId}/deployments`
  );

  return response.data;
}

interface CreateDeploymentInput {
  serviceName?: string;
}

export async function createDeployment(
  projectId: string,
  input: CreateDeploymentInput = {}
): Promise<ApiDeployment> {
  const response = await postJson<ApiDataResponse<ApiDeployment>>(
    `/v1/projects/${projectId}/deployments`,
    {
      ...(input.serviceName ? { serviceName: input.serviceName } : {})
    }
  );

  return response.data;
}

const fetchViewerContextByAuth = cache(async (
  bearerToken: string | null,
  demoUserIdValue: string | null
): Promise<ViewerContextFetchResult> => {
  const response = await requestApi('/v1/auth/me', {
    headers: buildAuthHeaders({
      bearerToken,
      demoUserId: demoUserIdValue
    })
  });

  if (response.status === 401 || response.status === 403) {
    return {
      viewer: null,
      statusCode: response.status
    };
  }

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  const payload = await response.json() as ApiDataResponse<ApiViewerContext>;
  return {
    viewer: payload.data,
    statusCode: response.status
  };
});

export async function fetchViewerContext(): Promise<ApiViewerContext | null> {
  const auth = getDashboardRequestAuth();
  const result = await fetchViewerContextByAuth(auth.bearerToken, auth.demoUserId);
  return result.viewer;
}

export async function resolveViewerContext(): Promise<{
  viewer: ApiViewerContext | null;
  error: unknown | null;
  statusCode: number | null;
}> {
  const auth = getDashboardRequestAuth();

  try {
    const result = await fetchViewerContextByAuth(auth.bearerToken, auth.demoUserId);

    return {
      viewer: result.viewer,
      error:
        result.viewer || result.statusCode === null
          ? null
          : new Error(`API_REQUEST_FAILED ${result.statusCode}`),
      statusCode: result.statusCode
    };
  } catch (error) {
    return {
      viewer: null,
      error,
      statusCode:
        error instanceof Error
          ? Number.parseInt(error.message.match(/API_REQUEST_FAILED\s+(\d+)/)?.[1] ?? '', 10) || null
          : null
    };
  }
}

export async function fetchProjectsForCurrentUser(): Promise<ApiProject[]> {
  const viewer = await fetchViewerContext();
  if (!viewer) {
    return [];
  }

  const response = await fetchJson<ApiDataResponse<ApiProject[]>>(
    `/v1/users/${viewer.userId}/projects`
  );

  return response.data;
}

interface CreateProjectInput {
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch?: string;
  services?: ProjectServiceDefinition[];
}

export async function createProject(input: CreateProjectInput): Promise<ApiProject> {
  const response = await postJson<ApiDataResponse<ApiProject>>('/v1/projects', { ...input });

  return response.data;
}

export async function fetchProjectMembers(projectId: string): Promise<ApiProjectMember[]> {
  const response = await fetchJson<ApiDataResponse<ApiProjectMember[]>>(
    `/v1/projects/${projectId}/members`
  );

  return response.data;
}

interface FetchProjectDomainsOptions {
  includeDiagnostics?: boolean;
}

export async function fetchProjectDomains(
  projectId: string,
  options: FetchProjectDomainsOptions = {}
): Promise<ApiProjectDomain[]> {
  const query = new URLSearchParams();
  if (options.includeDiagnostics) {
    query.set('includeDiagnostics', 'true');
  }

  const response = await fetchJson<ApiDataResponse<ApiProjectDomain[]>>(
    `/v1/projects/${projectId}/domains${query.size > 0 ? `?${query.toString()}` : ''}`
  );

  return response.data;
}

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

export async function createProjectDomain(
  projectId: string,
  input: {
    host: string;
  }
): Promise<ApiProjectDomain> {
  const response = await postJson<ApiDataResponse<ApiProjectDomain>>(
    `/v1/projects/${projectId}/domains`,
    {
      host: input.host
    }
  );

  return response.data;
}

export async function removeProjectDomain(projectId: string, domainId: string): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/domains/${domainId}`);
}

export async function verifyProjectDomain(
  projectId: string,
  domainId: string
): Promise<ApiProjectDomain> {
  const response = await postJson<ApiDataResponse<ApiProjectDomain>>(
    `/v1/projects/${projectId}/domains/${domainId}/verify`,
    {}
  );

  return response.data;
}

export async function fetchProjectInvitations(projectId: string): Promise<ApiProjectInvitation[]> {
  const response = await fetchJson<ApiDataResponse<ApiProjectInvitation[]>>(
    `/v1/projects/${projectId}/invitations`
  );

  return response.data;
}

export async function fetchProjectInvitationClaim(
  claimToken: string
): Promise<ApiProjectInvitationClaim | null> {
  const response = await requestApi(`/v1/project-invitations/claim/${encodeURIComponent(claimToken)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  const payload = await response.json() as ApiDataResponse<ApiProjectInvitationClaim>;
  return payload.data;
}

export async function inviteProjectMember(
  projectId: string,
  input: {
    email: string;
    role: 'viewer' | 'editor' | 'admin';
  }
): Promise<ApiProjectInviteResult> {
  const response = await postJson<ApiDataResponse<ApiProjectInviteResult>>(
    `/v1/projects/${projectId}/members`,
    {
      email: input.email,
      role: input.role
    }
  );

  return response.data;
}

export async function updateProjectInvitation(
  projectId: string,
  invitationId: string,
  input: {
    role: 'viewer' | 'editor' | 'admin';
  }
): Promise<ApiProjectInvitation> {
  const response = await putJson<ApiDataResponse<ApiProjectInvitation>>(
    `/v1/projects/${projectId}/invitations/${invitationId}`,
    {
      role: input.role
    }
  );

  return response.data;
}

export async function removeProjectInvitation(
  projectId: string,
  invitationId: string
): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/invitations/${invitationId}`);
}

export async function redeliverProjectInvitation(
  projectId: string,
  invitationId: string
): Promise<ApiProjectInvitationRedeliveryResult> {
  const response = await postJson<ApiDataResponse<ApiProjectInvitationRedeliveryResult>>(
    `/v1/projects/${projectId}/invitations/${invitationId}/redeliver`,
    {}
  );

  return response.data;
}

export async function acceptProjectInvitationClaim(
  claimToken: string
): Promise<ApiProjectInvitationClaim> {
  const response = await postJson<ApiDataResponse<ApiProjectInvitationClaim>>(
    `/v1/project-invitations/claim/${encodeURIComponent(claimToken)}/accept`,
    {}
  );

  return response.data;
}

export async function updateProjectMemberRole(
  projectId: string,
  memberUserId: string,
  input: {
    role: 'viewer' | 'editor' | 'admin';
  }
): Promise<ApiProjectMember> {
  const response = await putJson<ApiDataResponse<ApiProjectMember>>(
    `/v1/projects/${projectId}/members/${memberUserId}`,
    {
      role: input.role
    }
  );

  return response.data;
}

export async function removeProjectMember(
  projectId: string,
  memberUserId: string
): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/members/${memberUserId}`);
}

export async function transferProjectOwnership(
  projectId: string,
  memberUserId: string
): Promise<ApiProjectMember> {
  const response = await postJson<ApiDataResponse<ApiProjectMember>>(
    `/v1/projects/${projectId}/ownership`,
    {
      userId: memberUserId
    }
  );

  return response.data;
}

interface UpsertViewerProfileInput {
  name: string;
  email: string;
}

export async function upsertViewerProfile(
  input: UpsertViewerProfileInput
): Promise<ApiViewerContext> {
  const response = await putJson<ApiDataResponse<ApiViewerContext>>('/v1/auth/me/profile', {
    name: input.name,
    email: input.email
  });

  return response.data;
}

interface CreateApiTokenInput {
  userId: string;
  role: 'admin' | 'user';
  scopes?: string[];
  label?: string;
  expiresAt?: string;
}

export async function fetchApiTokensForUser(userId: string): Promise<ApiTokenRecord[]> {
  const response = await fetchJson<ApiDataResponse<ApiTokenRecord[]>>(`/v1/users/${userId}/api-tokens`);

  return response.data;
}

export async function createApiToken(input: CreateApiTokenInput): Promise<CreatedApiTokenRecord> {
  const response = await postJson<ApiDataResponse<CreatedApiTokenRecord>>(`/v1/users/${input.userId}/api-tokens`, {
    role: input.role,
    ...(input.scopes && input.scopes.length > 0 ? { scopes: input.scopes } : {}),
    ...(input.label ? { label: input.label } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
  });

  return response.data;
}

export async function rotateApiToken(userId: string, tokenId: string): Promise<CreatedApiTokenRecord> {
  const response = await postJson<ApiDataResponse<CreatedApiTokenRecord>>(
    `/v1/users/${userId}/api-tokens/${tokenId}/rotate`,
    {}
  );

  return response.data;
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<void> {
  await deleteRequest(`/v1/users/${userId}/api-tokens/${tokenId}`);
}

export async function fetchEnvironmentVariables(projectId: string): Promise<ApiEnvironmentVariable[]> {
  const response = await fetchJson<ApiDataResponse<ApiEnvironmentVariable[]>>(
    `/v1/projects/${projectId}/environment-variables`
  );

  return response.data;
}

export async function upsertEnvironmentVariable(
  projectId: string,
  key: string,
  value: string
): Promise<ApiEnvironmentVariable> {
  const response = await putJson<ApiDataResponse<ApiEnvironmentVariable>>(
    `/v1/projects/${projectId}/environment-variables`,
    { key, value }
  );

  return response.data;
}

export async function deleteEnvironmentVariable(projectId: string, key: string): Promise<void> {
  await deleteRequest(`/v1/projects/${projectId}/environment-variables/${encodeURIComponent(key)}`);
}

export async function fetchDeploymentLogs(
  projectId: string,
  deploymentId: string,
  limit = 100
): Promise<ApiDeploymentLog[]> {
  const response = await fetchJson<ApiDataResponse<ApiDeploymentLog[]>>(
    `/v1/projects/${projectId}/deployments/${deploymentId}/logs?limit=${limit}`
  );

  return response.data;
}

export async function fetchQueueHealth(): Promise<ApiQueueHealth> {
  try {
    const response = await requestApi('/health/queue', {
      headers: buildDashboardAuthHeaders()
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return normalizeQueueHealthPayload(payload, `API_REQUEST_FAILED ${response.status}`);
    }

    return normalizeQueueHealthPayload(payload, 'Queue health payload unavailable.');
  } catch (error) {
    return {
      status: 'unavailable',
      message: getErrorMessage(error)
    };
  }
}

export async function fetchWorkerHealth(): Promise<ApiWorkerHealth> {
  try {
    const response = await requestApi('/health/worker', {
      headers: buildDashboardAuthHeaders()
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return normalizeWorkerHealthPayload(payload, `API_REQUEST_FAILED ${response.status}`);
    }

    return normalizeWorkerHealthPayload(payload, 'Worker health payload unavailable.');
  } catch (error) {
    return {
      status: 'unavailable',
      message: getErrorMessage(error)
    };
  }
}

export async function fetchApiHealth(): Promise<ApiServiceHealth> {
  try {
    const response = await requestApi('/health');

    if (!response.ok) {
      const fallback = await response.json().catch(() => ({}));
      return {
        status: 'unavailable',
        message: typeof fallback?.message === 'string' ? fallback.message : `API_REQUEST_FAILED ${response.status}`
      };
    }

    const payload = await response.json().catch(() => ({} as { status?: string; message?: string }));
    return {
      status: payload.status === 'ok' ? 'ok' : 'unavailable',
      ...(typeof payload.message === 'string' ? { message: payload.message } : {})
    };
  } catch (error) {
    return {
      status: 'unavailable',
      message: getErrorMessage(error)
    };
  }
}

export async function fetchViewerContextForBearerToken(
  bearerToken: string
): Promise<ApiViewerContext | null> {
  const trimmedToken = bearerToken.trim();

  if (trimmedToken.length === 0) {
    return null;
  }

  const result = await fetchViewerContextByAuth(trimmedToken, null);
  return result.viewer;
}

export { apiBaseUrl, demoUserId, apiAuthToken };
