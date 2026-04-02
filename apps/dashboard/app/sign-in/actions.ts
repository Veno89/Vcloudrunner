'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fetchViewerContextForBearerToken, loginWithCredentials } from '@/lib/api';
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

export async function signInWithCredentialsAction(formData: FormData) {
  const email = typeof formData.get('email') === 'string' ? String(formData.get('email')).trim() : '';
  const password = typeof formData.get('password') === 'string' ? String(formData.get('password')) : '';
  const redirectTo = normalizeDashboardRedirectTarget(
    typeof formData.get('redirectTo') === 'string' ? String(formData.get('redirectTo')) : null
  );

  if (!email || !password) {
    redirectWithMessage('error', 'Email and password are required.', redirectTo);
    return;
  }

  try {
    const result = await loginWithCredentials({ email, password });

    setDashboardSessionToken(result.token);
    revalidatePath('/', 'layout');

    if (redirectTo !== '/settings/account') {
      redirect(redirectTo);
    }

    redirect(`/settings/account?status=success&message=${encodeURIComponent(`Signed in as ${result.viewer.user?.name ?? result.viewer.user?.email ?? result.viewer.userId}`)}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    const statusMatch = error instanceof Error ? error.message.match(/API_REQUEST_FAILED\s+(\d+)/) : null;
    const statusCode = statusMatch ? Number(statusMatch[1]) : null;

    if (statusCode === 401) {
      redirectWithMessage('error', 'Invalid email or password.', redirectTo);
    } else {
      redirectWithMessage('error', 'Sign-in failed. Please try again.', redirectTo);
    }
  }
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
