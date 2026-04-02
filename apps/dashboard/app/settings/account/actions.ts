'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type ApiViewerContext,
  upsertViewerProfile,
  resolveViewerContext,
  changePassword
} from '@/lib/api';
import { createViewerContextFailureRedirect } from '@/lib/dashboard-action-auth';
import {
  buildDashboardAccountSetupHref,
  normalizeDashboardRedirectTarget
} from '@/lib/dashboard-auth-navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { extractApiStatusCode } from '@/lib/helpers';

function redirectToAccount(
  status: 'success' | 'error',
  message: string,
  redirectTo?: string | null
) {
  redirect(buildDashboardAccountSetupHref({
    ...(redirectTo && redirectTo !== '/settings/account' ? { redirectTo } : {}),
    status,
    message
  }));
}

function appendStatusMessageToPath(
  path: string,
  status: 'success' | 'error',
  message: string
) {
  const [pathname, existingQuery = ''] = path.split('?', 2);
  const params = new URLSearchParams(existingQuery);
  params.set('status', status);
  params.set('message', message);
  const query = params.toString();

  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

function createAcceptedInvitationSuccessMessage(
  acceptedProjectInvitations: ApiViewerContext['acceptedProjectInvitations']
) {
  const acceptedInvitations = acceptedProjectInvitations ?? [];

  if (acceptedInvitations.length === 0) {
    return 'Account profile created.';
  }

  if (acceptedInvitations.length === 1) {
    const invitation = acceptedInvitations[0];
    return `Account profile created and joined ${invitation.projectName} as ${invitation.role}.`;
  }

  const highlightedInvitations = acceptedInvitations.slice(0, 2)
    .map((invitation) => `${invitation.projectName} (${invitation.role})`);
  const remainingInvitationCount = acceptedInvitations.length - highlightedInvitations.length;
  const invitationSummary = highlightedInvitations.join(', ');

  return remainingInvitationCount > 0
    ? `Account profile created and accepted ${acceptedInvitations.length} project invitations: ${invitationSummary}, and ${remainingInvitationCount} more.`
    : `Account profile created and accepted project invitations for ${invitationSummary}.`;
}

export async function saveViewerProfileAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const redirectTo = normalizeDashboardRedirectTarget(
    typeof formData.get('redirectTo') === 'string' ? String(formData.get('redirectTo')) : null
  );

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: '/settings/account',
        fallbackPath: '/settings/account',
        fallbackMessage: 'Account setup is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  const name = typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : '';
  const email = typeof formData.get('email') === 'string' ? String(formData.get('email')).trim() : '';

  if (name.length === 0 || email.length === 0) {
    redirectToAccount('error', 'Enter a valid name and email.', redirectTo);
    return;
  }

  try {
    const updatedViewer = await upsertViewerProfile({ name, email });
    const successMessage = viewer.user
      ? 'Account profile updated.'
      : createAcceptedInvitationSuccessMessage(updatedViewer.acceptedProjectInvitations);

    revalidatePath('/settings');
    revalidatePath('/settings/account');
    revalidatePath('/settings/tokens');
    revalidatePath('/tokens');
    revalidatePath('/projects');
    if (redirectTo.startsWith('/')) {
      revalidatePath(redirectTo);
    }

    if (redirectTo !== '/settings/account') {
      redirect(appendStatusMessageToPath(redirectTo, 'success', successMessage));
    }

    redirectToAccount('success', successMessage);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      redirect(
        createViewerContextFailureRedirect({
          requestAuth,
          error,
          redirectTo: '/settings/account',
          fallbackPath: '/settings/account',
          fallbackMessage: 'Account setup is temporarily unavailable. Check dashboard/API connectivity and retry.'
        })
      );
      return;
    }

    if (statusCode === 409) {
      redirectToAccount('error', 'That email is already used by another account.', redirectTo);
      return;
    }

    if (statusCode === 400) {
      redirectToAccount('error', 'Enter a valid name and email.', redirectTo);
      return;
    }

    redirectToAccount('error', 'Failed to save account profile.', redirectTo);
  }
}

export async function changePasswordAction(formData: FormData) {
  const currentPassword = typeof formData.get('currentPassword') === 'string' ? String(formData.get('currentPassword')) : '';
  const newPassword = typeof formData.get('newPassword') === 'string' ? String(formData.get('newPassword')) : '';
  const confirmNewPassword = typeof formData.get('confirmNewPassword') === 'string' ? String(formData.get('confirmNewPassword')) : '';

  if (!currentPassword || !newPassword) {
    redirectToAccount('error', 'Current and new passwords are required.');
    return;
  }

  if (newPassword.length < 8) {
    redirectToAccount('error', 'New password must be at least 8 characters.');
    return;
  }

  if (newPassword !== confirmNewPassword) {
    redirectToAccount('error', 'New passwords do not match.');
    return;
  }

  try {
    await changePassword(currentPassword, newPassword);
    redirectToAccount('success', 'Password changed successfully.');
  } catch (error) {
    const statusCode = extractApiStatusCode(error);

    if (statusCode === 401) {
      redirectToAccount('error', 'Current password is incorrect.');
      return;
    }

    redirectToAccount('error', 'Failed to change password.');
  }
}
