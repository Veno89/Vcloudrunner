'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fetchViewerContextForBearerToken } from '@/lib/api';
import {
  buildDashboardAccountSetupHref,
  buildDashboardSignInHref,
  normalizeDashboardRedirectTarget
} from '@/lib/dashboard-auth-navigation';
import {
  clearDashboardSessionToken,
  setDashboardSessionToken
} from '@/lib/dashboard-session';

function redirectWithMessage(
  status: 'success' | 'error',
  message: string,
  redirectTo?: string
) {
  const href = buildDashboardSignInHref({
    ...(redirectTo ? { redirectTo } : {})
  });
  const joiner = href.includes('?') ? '&' : '?';
  redirect(`${href}${joiner}status=${status}&message=${encodeURIComponent(message)}`);
}

export async function signInWithApiTokenAction(formData: FormData) {
  const tokenValue = formData.get('token');
  const token = typeof tokenValue === 'string' ? tokenValue.trim() : '';
  const redirectTo = normalizeDashboardRedirectTarget(
    typeof formData.get('redirectTo') === 'string' ? String(formData.get('redirectTo')) : null
  );

  if (token.length < 8) {
    redirectWithMessage('error', 'Enter a valid API token.', redirectTo);
    return;
  }

  const viewer = await fetchViewerContextForBearerToken(token);
  if (!viewer) {
    redirectWithMessage('error', 'The provided API token was rejected.', redirectTo);
    return;
  }

  setDashboardSessionToken(token);
  revalidatePath('/', 'layout');

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      ...(redirectTo !== '/settings/account' ? { redirectTo } : {}),
      status: 'success',
      message: 'Signed in. Complete account setup to continue.'
    }));
  }

  if (redirectTo !== '/settings/account') {
    redirect(redirectTo);
  }

  redirect(`/settings/account?status=success&message=${encodeURIComponent(`Signed in as ${viewer.user?.name ?? viewer.user?.email ?? viewer.userId}`)}`);
}

export async function signOutDashboardSessionAction(formData?: FormData) {
  const redirectTo =
    typeof formData?.get('redirectTo') === 'string'
      ? normalizeDashboardRedirectTarget(String(formData.get('redirectTo')))
      : null;
  clearDashboardSessionToken();
  revalidatePath('/', 'layout');
  redirectWithMessage('success', 'Signed out', redirectTo ?? undefined);
}
