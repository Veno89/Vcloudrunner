import type { ApiProject } from './api';

export function deriveDomain(project: ApiProject): string {
  return `${project.slug}.apps.platform.example.com`;
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
  if (statusCode === 409) {
    return `Cannot deploy "${projectName}": another deployment is already active.`;
  }

  if (statusCode === 503) {
    return `Cannot deploy "${projectName}": deployment queue is unavailable. Please retry shortly.`;
  }

  return `Failed to deploy "${projectName}"`;
}
