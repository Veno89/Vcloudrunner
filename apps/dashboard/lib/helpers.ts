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
