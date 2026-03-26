import { cookies } from 'next/headers';

const DASHBOARD_SESSION_COOKIE_NAME = 'vcloudrunner_dashboard_session';

export type DashboardRequestTransport =
  | 'session-cookie'
  | 'server-env-token'
  | 'dev-user-header'
  | 'unconfigured';

export interface DashboardRequestAuth {
  bearerToken: string | null;
  demoUserId: string | null;
  tokenSource: 'session-cookie' | 'server-env-token' | null;
  transport: DashboardRequestTransport;
  hasBearerToken: boolean;
  hasDemoUserId: boolean;
  hasAnyAuth: boolean;
}

function createDashboardSessionCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production'
  };
}

export function getDashboardSessionToken(): string | null {
  return cookies().get(DASHBOARD_SESSION_COOKIE_NAME)?.value ?? null;
}

export function setDashboardSessionToken(token: string) {
  cookies().set(
    DASHBOARD_SESSION_COOKIE_NAME,
    token,
    createDashboardSessionCookieOptions()
  );
}

export function clearDashboardSessionToken() {
  cookies().delete(DASHBOARD_SESSION_COOKIE_NAME);
}

export function getDashboardRequestAuth(): DashboardRequestAuth {
  const sessionToken = getDashboardSessionToken();
  const envToken = process.env.API_AUTH_TOKEN?.trim() || null;
  const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID?.trim() || null;
  const bearerToken = sessionToken ?? envToken;
  const tokenSource =
    sessionToken
      ? 'session-cookie'
      : envToken
        ? 'server-env-token'
        : null;
  const transport =
    tokenSource
      ?? (demoUserId ? 'dev-user-header' : 'unconfigured');

  return {
    bearerToken,
    demoUserId,
    tokenSource,
    transport,
    hasBearerToken: Boolean(bearerToken),
    hasDemoUserId: Boolean(demoUserId),
    hasAnyAuth: Boolean(bearerToken || demoUserId)
  };
}
