import type { ApiViewerAuthSource, ApiViewerContext } from './api';
import type { DashboardRequestAuth } from './dashboard-session';

type BadgeVariant = 'success' | 'warning' | 'destructive' | 'outline' | 'info';

export function getViewerScopeLabels(viewer: ApiViewerContext): string[] {
  if (viewer.scopes.length > 0) {
    return viewer.scopes;
  }

  return viewer.role === 'admin'
    ? ['implicit admin access']
    : ['no explicit scopes'];
}

export function getDashboardAuthTransport(auth: DashboardRequestAuth): {
  label: string;
  variant: BadgeVariant;
  description: string;
} {
  switch (auth.transport) {
    case 'session-cookie':
      return {
        label: 'session cookie',
        variant: 'success',
        description: 'Dashboard requests authenticate with the current per-user session cookie. This is now the preferred live auth path.'
      };
    case 'server-env-token':
      return {
        label: 'server env token',
        variant: 'warning',
        description: 'Dashboard requests are still falling back to API_AUTH_TOKEN from the server environment instead of a per-user session.'
      };
    case 'dev-user-header':
      return {
        label: 'dev auth header',
        variant: 'warning',
        description: 'Dashboard requests currently rely on x-user-id only. This is intended for local ENABLE_DEV_AUTH flows.'
      };
    case 'unconfigured':
      return {
        label: 'unconfigured',
        variant: 'destructive',
        description: 'No session cookie, bearer token fallback, or local dev-auth user hint is configured for dashboard API requests.'
      };
  }
}

export function getViewerAuthSourceDetails(authSource: ApiViewerAuthSource): {
  label: string;
  variant: BadgeVariant;
  description: string;
  modeLabel: string;
  recommendation: string;
} {
  switch (authSource) {
    case 'database-token':
      return {
        label: 'db token',
        variant: 'success',
        modeLabel: 'token-backed session',
        description: 'Authenticated through a DB-backed API token that can be rotated or revoked from token management.',
        recommendation: 'This is the preferred non-demo auth path for the current platform shape.'
      };
    case 'bootstrap-token':
      return {
        label: 'bootstrap token',
        variant: 'warning',
        modeLabel: 'token-backed session',
        description: 'Authenticated through a static bootstrap token from API startup configuration rather than a persisted token record.',
        recommendation: 'Use this as a bootstrap path, then rotate toward DB-backed tokens for regular operator workflows.'
      };
    case 'dev-user-header':
      return {
        label: 'dev user header',
        variant: 'warning',
        modeLabel: 'development bypass',
        description: 'Authenticated through the explicit local dev-auth x-user-id header path.',
        recommendation: 'Keep this limited to local development while the broader login/session workflow is still in progress.'
      };
    case 'dev-admin-token':
      return {
        label: 'dev admin token',
        variant: 'destructive',
        modeLabel: 'development bypass',
        description: 'Authenticated through the local-only dev-admin-token bypass, which grants admin access.',
        recommendation: 'Treat this as a temporary local bootstrap tool only, not a normal operator workflow.'
      };
  }
}
