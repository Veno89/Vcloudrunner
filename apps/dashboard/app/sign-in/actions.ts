'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fetchViewerContextForBearerToken } from '@/lib/api';
import {
  clearDashboardSessionToken,
  setDashboardSessionToken
} from '@/lib/dashboard-session';

function redirectWithMessage(status: 'success' | 'error', message: string) {
  redirect(`/sign-in?status=${status}&message=${encodeURIComponent(message)}`);
}

export async function signInWithApiTokenAction(formData: FormData) {
  const tokenValue = formData.get('token');
  const token = typeof tokenValue === 'string' ? tokenValue.trim() : '';

  if (token.length < 8) {
    redirectWithMessage('error', 'Enter a valid API token.');
    return;
  }

  const viewer = await fetchViewerContextForBearerToken(token);
  if (!viewer) {
    redirectWithMessage('error', 'The provided API token was rejected.');
    return;
  }

  setDashboardSessionToken(token);
  revalidatePath('/', 'layout');
  redirect(`/settings/account?status=success&message=${encodeURIComponent(`Signed in as ${viewer.user?.name ?? viewer.user?.email ?? viewer.userId}`)}`);
}

export async function signOutDashboardSessionAction() {
  clearDashboardSessionToken();
  revalidatePath('/', 'layout');
  redirect('/sign-in?status=success&message=Signed+out');
}
