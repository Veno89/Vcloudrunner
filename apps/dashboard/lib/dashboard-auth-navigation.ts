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
