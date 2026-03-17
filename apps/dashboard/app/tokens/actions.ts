'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createApiToken, revokeApiToken, rotateApiToken, demoUserId } from '@/lib/api';
import { extractApiStatusCode } from '@/lib/helpers';

function createTokenActionErrorMessage(action: 'create' | 'revoke' | 'rotate', error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Token management is unauthorized. Check API_AUTH_TOKEN or the explicit local dev-auth bypass.';
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
  if (!demoUserId) {
    redirect('/settings/tokens?status=error&message=No+user+context');
    return;
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
      userId: demoUserId,
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
  if (!demoUserId) {
    redirect('/settings/tokens?status=error&message=No+user+context');
    return;
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/settings/tokens?status=error&message=Invalid+token');
    return;
  }

  try {
    await revokeApiToken(demoUserId, tokenIdValue);
    revalidatePath('/settings/tokens');
    revalidatePath('/tokens');
    redirect('/settings/tokens?status=success&message=Token+revoked');
  } catch (error) {
    redirect(`/settings/tokens?status=error&message=${encodeURIComponent(createTokenActionErrorMessage('revoke', error))}`);
  }
}

export async function rotateApiTokenAction(formData: FormData) {
  if (!demoUserId) {
    redirect('/settings/tokens?status=error&message=No+user+context');
    return;
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/settings/tokens?status=error&message=Invalid+token');
    return;
  }

  try {
    const rotated = await rotateApiToken(demoUserId, tokenIdValue);
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
