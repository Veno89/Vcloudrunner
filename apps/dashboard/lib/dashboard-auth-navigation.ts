export type DashboardPlan = 'free' | 'pro';

export function normalizeDashboardRedirectTarget(
  value: string | null | undefined,
  fallback = '/settings/account'
): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return fallback;
  }

  return normalized;
}

export function normalizeDashboardPlan(
  value: string | null | undefined,
  fallback: DashboardPlan = 'free'
): DashboardPlan {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'pro' ? 'pro' : fallback;
}

export function buildDashboardSignInHref(input?: {
  redirectTo?: string | null;
  reason?: 'sign-in-required' | 'session-expired' | 'access-denied' | null;
}): string {
  const params = new URLSearchParams();

  if (input?.redirectTo) {
    params.set('redirectTo', input.redirectTo);
  }

  if (input?.reason) {
    params.set('reason', input.reason);
  }

  const query = params.toString();
  return query.length > 0 ? `/sign-in?${query}` : '/sign-in';
}

export function buildDashboardRegisterHref(input?: {
  redirectTo?: string | null;
  plan?: DashboardPlan | null;
}): string {
  const params = new URLSearchParams();

  if (input?.redirectTo) {
    params.set('redirectTo', input.redirectTo);
  }

  if (input?.plan) {
    params.set('plan', normalizeDashboardPlan(input.plan));
  }

  const query = params.toString();
  return query.length > 0 ? `/register?${query}` : '/register';
}

export function buildDashboardAccountSetupHref(input?: {
  redirectTo?: string | null;
  status?: 'success' | 'error' | null;
  message?: string | null;
}): string {
  const params = new URLSearchParams();

  if (input?.redirectTo) {
    params.set('redirectTo', input.redirectTo);
  }

  if (input?.status) {
    params.set('status', input.status);
  }

  if (input?.message) {
    params.set('message', input.message);
  }

  const query = params.toString();
  return query.length > 0 ? `/settings/account?${query}` : '/settings/account';
}
