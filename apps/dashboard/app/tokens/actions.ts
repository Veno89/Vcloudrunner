'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createViewerContextFailureRedirect } from '@/lib/dashboard-action-auth';
import { buildDashboardAccountSetupHref } from '@/lib/dashboard-auth-navigation';
import { createApiToken, revokeApiToken, rotateApiToken, resolveViewerContext } from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { extractApiStatusCode } from '@/lib/helpers';

function createTokenActionErrorMessage(action: 'create' | 'revoke' | 'rotate', error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Token management is unauthorized. Sign in again with an active dashboard session, use API_AUTH_TOKEN only as a temporary fallback, or use the explicit local dev-auth bypass.';
  }

  if (statusCode === 403) {
    return 'Token management is authenticated but lacks the required token scopes or user access.';
  }

  if (statusCode === 404 && action !== 'create') {
    return 'The requested token no longer exists.';
  }

  if (action === 'create') {
    return 'Failed to create token.';
  }

  if (action === 'revoke') {
    return 'Failed to revoke token.';
  }

  return 'Failed to rotate token.';
}

export async function createApiTokenAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: '/settings/tokens',
        fallbackPath: '/settings/tokens',
        fallbackMessage: 'Token management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: '/settings/tokens'
    }));
  }

  const labelValue = formData.get('label');
  const roleValue = formData.get('role');
  const expiresAtValue = formData.get('expiresAt');

  if (typeof roleValue !== 'string' || (roleValue !== 'admin' && roleValue !== 'user')) {
    redirect('/settings/tokens?status=error&message=Invalid+role');
    return;
  }

  const label = typeof labelValue === 'string' ? labelValue.trim() : '';
  const expiresAt = typeof expiresAtValue === 'string' ? expiresAtValue.trim() : '';

  const scopeValues = formData.getAll('scopes');
  const scopes = scopeValues
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  try {
    const created = await createApiToken({
      userId: viewer.userId,
      role: roleValue,
      scopes: scopes.length > 0 ? scopes : undefined,
      label: label.length > 0 ? label : undefined,
      expiresAt: expiresAt.length > 0 ? new Date(expiresAt).toISOString() : undefined,
    });

    revalidatePath('/settings/tokens');
    revalidatePath('/tokens');
    cookies().set('__token_plaintext', created.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 120,
      path: '/',
      sameSite: 'strict',
    });
    redirect(
      `/settings/tokens?status=success&message=${encodeURIComponent(`Token "${created.label ?? 'token'}" created`)}`
    );
  } catch (error) {
    redirect(`/settings/tokens?status=error&message=${encodeURIComponent(createTokenActionErrorMessage('create', error))}`);
  }
}

export async function revokeApiTokenAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: '/settings/tokens',
        fallbackPath: '/settings/tokens',
        fallbackMessage: 'Token revocation is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: '/settings/tokens'
    }));
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/settings/tokens?status=error&message=Invalid+token');
    return;
  }

  try {
    await revokeApiToken(viewer.userId, tokenIdValue);
    revalidatePath('/settings/tokens');
    revalidatePath('/tokens');
    redirect('/settings/tokens?status=success&message=Token+revoked');
  } catch (error) {
    redirect(`/settings/tokens?status=error&message=${encodeURIComponent(createTokenActionErrorMessage('revoke', error))}`);
  }
}

export async function rotateApiTokenAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: '/settings/tokens',
        fallbackPath: '/settings/tokens',
        fallbackMessage: 'Token rotation is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: '/settings/tokens'
    }));
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/settings/tokens?status=error&message=Invalid+token');
    return;
  }

  try {
    const rotated = await rotateApiToken(viewer.userId, tokenIdValue);
    revalidatePath('/settings/tokens');
    revalidatePath('/tokens');
    cookies().set('__token_plaintext', rotated.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 120,
      path: '/',
      sameSite: 'strict',
    });
    redirect(
      `/settings/tokens?status=success&message=${encodeURIComponent(`Token "${rotated.label ?? 'token'}" rotated`)}`
    );
  } catch (error) {
    redirect(`/settings/tokens?status=error&message=${encodeURIComponent(createTokenActionErrorMessage('rotate', error))}`);
  }
}
