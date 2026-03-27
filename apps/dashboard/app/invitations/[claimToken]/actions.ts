'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  acceptProjectInvitationClaim,
  resolveViewerContext
} from '@/lib/api';
import { createViewerContextFailureRedirect } from '@/lib/dashboard-action-auth';
import {
  buildDashboardAccountSetupHref,
  buildDashboardSignInHref,
  normalizeDashboardRedirectTarget
} from '@/lib/dashboard-auth-navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { extractApiStatusCode } from '@/lib/helpers';

function buildInvitationClaimPath(claimToken: string) {
  return `/invitations/${claimToken}`;
}

function createInvitationClaimErrorMessage(error: unknown) {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Sign in again to claim this invitation.';
  }

  if (statusCode === 403) {
    return 'This invitation belongs to a different email address. Sign in with the invited account and retry.';
  }

  if (statusCode === 404) {
    return 'This invitation is no longer available.';
  }

  if (statusCode === 409) {
    return 'This invitation is no longer pending. Refresh the page to see its latest state.';
  }

  return 'Failed to claim this invitation.';
}

export async function acceptProjectInvitationClaimAction(formData: FormData) {
  const claimTokenValue = formData.get('claimToken');
  if (typeof claimTokenValue !== 'string' || claimTokenValue.trim().length === 0) {
    redirect('/projects?status=error&message=Invalid+invitation+claim');
    return;
  }

  const claimToken = claimTokenValue.trim();
  const invitationPath = buildInvitationClaimPath(claimToken);
  const returnPath = normalizeDashboardRedirectTarget(
    typeof formData.get('returnPath') === 'string'
      ? String(formData.get('returnPath'))
      : invitationPath,
    invitationPath
  );
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: buildDashboardSignInHref({
          redirectTo: returnPath,
          reason: 'sign-in-required'
        }),
        fallbackMessage: 'Invitation claim is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath,
      status: 'error',
      message: 'Complete account setup before claiming this invitation.'
    }));
  }

  try {
    const invitation = await acceptProjectInvitationClaim(claimToken);

    revalidatePath('/projects');
    revalidatePath(`/projects/${invitation.projectId}`);
    revalidatePath(returnPath);

    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(
        `Joined ${invitation.projectName} as ${invitation.role}.`
      )}`
    );
  } catch (error) {
    redirect(
      `${returnPath}?status=error&message=${encodeURIComponent(
        createInvitationClaimErrorMessage(error)
      )}`
    );
  }
}
