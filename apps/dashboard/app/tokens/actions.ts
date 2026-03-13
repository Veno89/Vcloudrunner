'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createApiToken, revokeApiToken, rotateApiToken, demoUserId } from '@/lib/api';

export async function createApiTokenAction(formData: FormData) {
  if (!demoUserId) {
    redirect('/tokens?status=error&message=No+user+context');
    return;
  }

  const labelValue = formData.get('label');
  const roleValue = formData.get('role');
  const expiresAtValue = formData.get('expiresAt');

  if (typeof roleValue !== 'string' || (roleValue !== 'admin' && roleValue !== 'user')) {
    redirect('/tokens?status=error&message=Invalid+role');
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

    revalidatePath('/tokens');
    cookies().set('__token_plaintext', created.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 120,
      path: '/',
      sameSite: 'strict',
    });
    redirect(
      `/tokens?status=success&message=${encodeURIComponent(`Token "${created.label ?? 'token'}" created`)}`
    );
  } catch {
    redirect('/tokens?status=error&message=Failed+to+create+token');
  }
}

export async function revokeApiTokenAction(formData: FormData) {
  if (!demoUserId) {
    redirect('/tokens?status=error&message=No+user+context');
    return;
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/tokens?status=error&message=Invalid+token');
    return;
  }

  try {
    await revokeApiToken(demoUserId, tokenIdValue);
    revalidatePath('/tokens');
    redirect('/tokens?status=success&message=Token+revoked');
  } catch {
    redirect('/tokens?status=error&message=Failed+to+revoke+token');
  }
}

export async function rotateApiTokenAction(formData: FormData) {
  if (!demoUserId) {
    redirect('/tokens?status=error&message=No+user+context');
    return;
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/tokens?status=error&message=Invalid+token');
    return;
  }

  try {
    const rotated = await rotateApiToken(demoUserId, tokenIdValue);
    revalidatePath('/tokens');
    cookies().set('__token_plaintext', rotated.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 120,
      path: '/',
      sameSite: 'strict',
    });
    redirect(
      `/tokens?status=success&message=${encodeURIComponent(`Token "${rotated.label ?? 'token'}" rotated`)}`
    );
  } catch {
    redirect('/tokens?status=error&message=Failed+to+rotate+token');
  }
}
