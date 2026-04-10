'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { registerWithCredentials } from '@/lib/api';
import {
  buildDashboardRegisterHref,
  normalizeDashboardPlan,
  normalizeDashboardRedirectTarget
} from '@/lib/dashboard-auth-navigation';
import { setDashboardSessionToken } from '@/lib/dashboard-session';

function redirectWithMessage(
  status: 'success' | 'error',
  message: string,
  options?: {
    redirectTo?: string;
    plan?: 'free' | 'pro';
  }
) {
  const href = buildDashboardRegisterHref({
    redirectTo: options?.redirectTo,
    plan: options?.plan
  });
  const joiner = href.includes('?') ? '&' : '?';
  redirect(`${href}${joiner}status=${status}&message=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData) {
  const name = typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : '';
  const email = typeof formData.get('email') === 'string' ? String(formData.get('email')).trim() : '';
  const password = typeof formData.get('password') === 'string' ? String(formData.get('password')) : '';
  const confirmPassword = typeof formData.get('confirmPassword') === 'string' ? String(formData.get('confirmPassword')) : '';
  const plan = normalizeDashboardPlan(
    typeof formData.get('plan') === 'string' ? String(formData.get('plan')) : null
  );
  const redirectTo = normalizeDashboardRedirectTarget(
    typeof formData.get('redirectTo') === 'string' ? String(formData.get('redirectTo')) : null
  );

  if (plan === 'pro') {
    redirectWithMessage('error', 'Pro checkout is not live yet. Start with the Free plan for now.', {
      redirectTo,
      plan
    });
    return;
  }

  if (!name || !email || !password) {
    redirectWithMessage('error', 'All fields are required.', { redirectTo, plan });
    return;
  }

  if (password.length < 8) {
    redirectWithMessage('error', 'Password must be at least 8 characters.', { redirectTo, plan });
    return;
  }

  if (password !== confirmPassword) {
    redirectWithMessage('error', 'Passwords do not match.', { redirectTo, plan });
    return;
  }

  try {
    const result = await registerWithCredentials({ name, email, password });

    setDashboardSessionToken(result.token);
    revalidatePath('/', 'layout');

    if (redirectTo !== '/settings/account') {
      redirect(redirectTo);
    }

    redirect(`/settings/account?status=success&message=${encodeURIComponent('Account created successfully.')}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    const statusMatch = error instanceof Error ? error.message.match(/API_REQUEST_FAILED\s+(\d+)/) : null;
    const statusCode = statusMatch ? Number(statusMatch[1]) : null;

    if (statusCode === 409) {
      redirectWithMessage('error', 'An account with this email already exists. Try signing in instead.', {
        redirectTo,
        plan
      });
    } else {
      redirectWithMessage('error', 'Registration failed. Please try again.', { redirectTo, plan });
    }
  }
}
