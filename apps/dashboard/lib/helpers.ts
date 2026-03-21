import type { ApiProject } from './api';

export function deriveDomain(project: ApiProject): string {
  return `${project.slug}.apps.platform.example.com`;
}

export function hasRequestedCancellation(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  const cancellation = (metadata as Record<string, unknown>).cancellation;
  if (!cancellation || typeof cancellation !== 'object' || Array.isArray(cancellation)) {
    return false;
  }

  const requestedAt = (cancellation as Record<string, unknown>).requestedAt;
  return typeof requestedAt === 'string' && requestedAt.trim().length > 0;
}

export function slugifyProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractApiStatusCode(error: unknown): number | null {
  if (error instanceof Error) {
    const match = error.message.match(/API_REQUEST_FAILED\s+(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

export function createProjectErrorReason(statusCode: number | null): string {
  if (statusCode === 409) {
    return 'slug_taken';
  }
  if (statusCode === 400) {
    return 'invalid_input';
  }
  if (statusCode === 401) {
    return 'auth_required';
  }
  if (statusCode === 403) {
    return 'access_denied';
  }
  return 'api_unavailable';
}

export function describeDashboardLiveDataFailure(input: {
  error?: unknown;
  hasDemoUserId: boolean;
  hasApiAuthToken: boolean;
}): string {
  if (!input.hasDemoUserId) {
    return 'Set NEXT_PUBLIC_DEMO_USER_ID to enable live dashboard data.';
  }

  const statusCode = extractApiStatusCode(input.error);

  if (statusCode === 401) {
    return input.hasApiAuthToken
      ? 'API_AUTH_TOKEN was rejected. Use a valid bearer token, or enable the explicit dev-auth bypass only for local-only testing.'
      : 'Live dashboard API requests are unauthorized. Set API_AUTH_TOKEN to a valid bearer token, or enable the explicit dev-auth bypass only for local-only testing.';
  }

  if (statusCode === 403) {
    return 'Dashboard token is authenticated but lacks access to the requested resources. Check token scopes and user/project access.';
  }

  return input.error instanceof Error ? input.error.message : 'Failed to fetch live API data.';
}

export function describePartialDashboardDeploymentFailure(input: {
  error?: unknown;
  failedProjectCount: number;
  totalProjectCount: number;
  hasDemoUserId: boolean;
  hasApiAuthToken: boolean;
}): string {
  const baseMessage = describeDashboardLiveDataFailure({
    error: input.error,
    hasDemoUserId: input.hasDemoUserId,
    hasApiAuthToken: input.hasApiAuthToken
  });

  if (input.totalProjectCount <= 0 || input.failedProjectCount <= 0) {
    return baseMessage;
  }

  const scope =
    input.failedProjectCount >= input.totalProjectCount
      ? `all ${input.totalProjectCount}`
      : `${input.failedProjectCount} of ${input.totalProjectCount}`;

  return `Deployment history is temporarily unavailable for ${scope} projects. Live results below may be incomplete. ${baseMessage}`;
}

export function describeDashboardProxyFailure(input: {
  feature: string;
  hasApiAuthToken: boolean;
  statusCode?: number | null;
  upstreamMessage?: string | null;
}): string {
  if (!input.hasApiAuthToken) {
    return `Dashboard ${input.feature} requires API_AUTH_TOKEN. Set a valid bearer token, or enable the explicit dev-auth bypass only for local-only testing.`;
  }

  if (input.statusCode === 401) {
    return `Dashboard ${input.feature} is unauthorized. API_AUTH_TOKEN was rejected, or the explicit dev-auth bypass is disabled.`;
  }

  if (input.statusCode === 403) {
    return `Dashboard ${input.feature} is authenticated but lacks access to the requested project or deployment logs.`;
  }

  if (input.statusCode !== null && input.statusCode !== undefined && input.statusCode >= 500) {
    return `Upstream API ${input.feature} is unavailable. Refresh and retry shortly.`;
  }

  const normalizedUpstreamMessage = input.upstreamMessage?.trim();
  return normalizedUpstreamMessage?.length ? normalizedUpstreamMessage : `Upstream ${input.feature} failed.`;
}

export function createDashboardProxyUnavailableMessage(feature: string): string {
  return `Unable to reach the upstream API ${feature}. Check NEXT_PUBLIC_API_BASE_URL and API availability, then retry.`;
}

export function createDashboardProxyTimeoutMessage(feature: string): string {
  return `Upstream API ${feature} timed out. Check NEXT_PUBLIC_API_BASE_URL and API availability, then retry.`;
}

export function createEnvironmentVariableActionErrorMessage(
  action: 'save' | 'delete',
  error: unknown
): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 400) {
    return 'Invalid environment variable input. Check the key/value format and retry.';
  }

  if (statusCode === 401) {
    return 'Environment management is unauthorized. Check API_AUTH_TOKEN or the explicit local dev-auth bypass.';
  }

  if (statusCode === 403) {
    return 'Environment management is authenticated but lacks the required scopes or project access.';
  }

  if (statusCode === 404) {
    return action === 'delete'
      ? 'The requested project or environment variable no longer exists.'
      : 'The requested project no longer exists.';
  }

  return action === 'save' ? 'Failed to save variable.' : 'Failed to delete variable.';
}

export function truncateUuid(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function formatRelativeTime(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const time = date.getTime();

  if (!Number.isFinite(time)) {
    return 'unknown';
  }

  const now = Date.now();
  const diffMs = now - time;

  if (diffMs < 0) {
    return 'just now';
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  return date.toLocaleDateString();
}


export function logLevelTextClassName(level: string): string {
  const normalized = level.toLowerCase();

  if (normalized === 'error' || normalized === 'fatal') {
    return 'text-destructive';
  }

  if (normalized === 'warn' || normalized === 'warning') {
    return 'text-foreground';
  }

  if (normalized === 'debug' || normalized === 'trace') {
    return 'text-muted-foreground';
  }

  return 'text-primary';
}


export function normalizeProjectDisplayName(value: unknown): string {
  if (typeof value !== 'string') {
    return 'project';
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : 'project';
}

export function createDeploymentErrorMessage(statusCode: number | null, projectName: string): string {
  if (statusCode === 401) {
    return `Cannot deploy "${projectName}": API_AUTH_TOKEN was rejected or local dev auth is disabled.`;
  }

  if (statusCode === 403) {
    return `Cannot deploy "${projectName}": the dashboard token lacks deployment access for this project.`;
  }

  if (statusCode === 404) {
    return `Cannot deploy "${projectName}": the project no longer exists or is no longer accessible.`;
  }

  if (statusCode === 409) {
    return `Cannot deploy "${projectName}": another deployment is already active.`;
  }

  if (statusCode === 503) {
    return `Cannot deploy "${projectName}": deployment queue is unavailable. Please retry shortly.`;
  }

  return `Failed to deploy "${projectName}"`;
}
