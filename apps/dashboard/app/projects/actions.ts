'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { createViewerContextFailureRedirect } from '@/lib/dashboard-action-auth';
import { buildDashboardAccountSetupHref } from '@/lib/dashboard-auth-navigation';
import {
  createProject,
  createDeployment,
  inviteProjectMember,
  redeliverProjectInvitation,
  removeProjectInvitation,
  removeProjectMember,
  resolveViewerContext,
  transferProjectOwnership,
  updateProjectInvitation,
  updateProjectMemberRole
} from '@/lib/api';
import {
  slugifyProjectName,
  extractApiStatusCode,
  createProjectErrorReason,
  createDeploymentErrorMessage,
  normalizeProjectDisplayName
} from '@/lib/helpers';

export async function createProjectAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: '/projects',
        fallbackPath: '/projects',
        fallbackMessage: 'Project creation is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: '/projects'
    }));
  }

  const nameValue = formData.get('name');
  const gitRepositoryUrlValue = formData.get('gitRepositoryUrl');
  const defaultBranchValue = formData.get('defaultBranch');

  if (typeof nameValue !== 'string' || typeof gitRepositoryUrlValue !== 'string') {
    redirect('/projects?status=error&reason=invalid_input');
    return;
  }

  const name = nameValue.trim();
  const gitRepositoryUrl = gitRepositoryUrlValue.trim();
  const defaultBranch = typeof defaultBranchValue === 'string' ? defaultBranchValue.trim() : '';
  const slug = slugifyProjectName(name);

  if (name.length < 3 || slug.length < 3 || gitRepositoryUrl.length === 0) {
    redirect('/projects?status=error&reason=invalid_input');
    return;
  }

  try {
    await createProject({
      userId: viewer.userId,
      name,
      slug,
      gitRepositoryUrl,
      defaultBranch: defaultBranch.length > 0 ? defaultBranch : undefined,
    });

    revalidatePath('/projects');
    redirect(`/projects?status=success&message=${encodeURIComponent(`Project "${name}" created`)}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const reason = createProjectErrorReason(statusCode);
    redirect(`/projects?status=error&reason=${reason}`);
  }
}

function normalizeActionReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') {
    return '/projects';
  }

  const normalized = value.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return '/projects';
  }

  return normalized;
}

function createProjectMemberInviteErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project membership management is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to manage project members for this project.';
  }

  if (statusCode === 404) {
    return 'That project is no longer available.';
  }

  if (statusCode === 409) {
    return 'That user is already a member of this project or already has a pending invitation.';
  }

  return 'Failed to invite project member.';
}

function createProjectMemberUpdateErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project membership management is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to manage project members for this project.';
  }

  if (statusCode === 404) {
    return 'That project member no longer exists.';
  }

  if (statusCode === 409) {
    return 'Project owner access cannot be changed here.';
  }

  return 'Failed to update project member.';
}

function createProjectMemberRemovalErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project membership management is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to manage project members for this project.';
  }

  if (statusCode === 404) {
    return 'That project member no longer exists.';
  }

  if (statusCode === 409) {
    return 'Project owner access cannot be removed here.';
  }

  return 'Failed to remove project member.';
}

function createProjectOwnershipTransferErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project ownership transfer is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'Only the current project owner can transfer ownership from the dashboard.';
  }

  if (statusCode === 404) {
    return 'That project member no longer exists.';
  }

  return 'Failed to transfer project ownership.';
}

function createProjectInvitationUpdateErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project invitation management is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to manage project invitations for this project.';
  }

  if (statusCode === 404) {
    return 'That pending invitation no longer exists.';
  }

  return 'Failed to update pending invitation.';
}

function createProjectInvitationRemovalErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project invitation management is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to manage project invitations for this project.';
  }

  if (statusCode === 404) {
    return 'That pending invitation no longer exists.';
  }

  return 'Failed to cancel pending invitation.';
}

function createProjectInvitationRedeliveryErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project invitation delivery is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to redeliver project invitations for this project.';
  }

  if (statusCode === 404) {
    return 'That pending invitation no longer exists.';
  }

  if (statusCode === 409) {
    return 'That invitation is no longer pending. Refresh the page to see the latest status.';
  }

  return 'Failed to redeliver pending invitation.';
}

function createInvitationDeliverySuccessMessage(input: {
  email: string;
  delivery: {
    status: 'disabled' | 'delivered' | 'failed';
  };
  mode: 'created' | 'redelivered';
}) {
  if (input.delivery.status === 'delivered') {
    return input.mode === 'created'
      ? `Stored invitation and delivered the claim link to ${input.email}`
      : `Redelivered the claim link to ${input.email}`;
  }

  if (input.delivery.status === 'failed') {
    return input.mode === 'created'
      ? `Stored invitation for ${input.email}, but outbound delivery failed. Share the claim link manually.`
      : `Outbound delivery failed for ${input.email}. Share the claim link manually.`;
  }

  return input.mode === 'created'
    ? `Stored invitation for ${input.email}. Delivery automation is disabled, so share the claim link manually.`
    : `Delivery automation is disabled. Share the claim link for ${input.email} manually.`;
}

export async function inviteProjectMemberAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project membership management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(`${returnPath}?status=error&message=Invalid+project+member+invite`);
    return;
  }

  const email = typeof formData.get('email') === 'string' ? String(formData.get('email')).trim() : '';
  const role = typeof formData.get('role') === 'string' ? String(formData.get('role')).trim() : '';

  if (email.length === 0 || (role !== 'viewer' && role !== 'editor' && role !== 'admin')) {
    redirect(`${returnPath}?status=error&message=Enter+a+valid+email+and+role`);
    return;
  }

  try {
    const inviteResult = await inviteProjectMember(projectIdValue, {
      email,
      role
    });

    revalidatePath(returnPath);
    revalidatePath('/projects');
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(
        inviteResult.kind === 'member'
          ? `Added ${email} to the project`
          : createInvitationDeliverySuccessMessage({
              email,
              delivery: inviteResult.delivery,
              mode: 'created'
            })
      )}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectMemberInviteErrorMessage(error))}`);
  }
}

export async function updateProjectMemberRoleAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const memberUserIdValue = formData.get('memberUserId');
  const memberEmailValue = formData.get('memberEmail');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project membership management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof memberUserIdValue !== 'string'
    || memberUserIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+project+member+update`);
    return;
  }

  const role = typeof formData.get('role') === 'string' ? String(formData.get('role')).trim() : '';
  if (role !== 'viewer' && role !== 'editor' && role !== 'admin') {
    redirect(`${returnPath}?status=error&message=Choose+a+valid+member+role`);
    return;
  }

  const memberLabel =
    typeof memberEmailValue === 'string' && memberEmailValue.trim().length > 0
      ? memberEmailValue.trim()
      : 'project member';

  try {
    const updatedMember = await updateProjectMemberRole(projectIdValue, memberUserIdValue, {
      role
    });

    revalidatePath(returnPath);
    revalidatePath('/projects');
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Updated ${memberLabel} to ${updatedMember.role}`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectMemberUpdateErrorMessage(error))}`);
  }
}

export async function updateProjectInvitationAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const invitationIdValue = formData.get('invitationId');
  const invitationEmailValue = formData.get('invitationEmail');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project invitation management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof invitationIdValue !== 'string'
    || invitationIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+pending+invitation+update`);
    return;
  }

  const role = typeof formData.get('role') === 'string' ? String(formData.get('role')).trim() : '';
  if (role !== 'viewer' && role !== 'editor' && role !== 'admin') {
    redirect(`${returnPath}?status=error&message=Choose+a+valid+pending+invite+role`);
    return;
  }

  const invitationLabel =
    typeof invitationEmailValue === 'string' && invitationEmailValue.trim().length > 0
      ? invitationEmailValue.trim()
      : 'pending invitation';

  try {
    const updatedInvitation = await updateProjectInvitation(projectIdValue, invitationIdValue, {
      role
    });

    revalidatePath(returnPath);
    revalidatePath('/projects');
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Updated pending invite for ${invitationLabel} to ${updatedInvitation.role}`)}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectInvitationUpdateErrorMessage(error))}`);
  }
}

export async function removeProjectInvitationAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const invitationIdValue = formData.get('invitationId');
  const invitationEmailValue = formData.get('invitationEmail');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project invitation management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof invitationIdValue !== 'string'
    || invitationIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+pending+invitation+removal`);
    return;
  }

  const invitationLabel =
    typeof invitationEmailValue === 'string' && invitationEmailValue.trim().length > 0
      ? invitationEmailValue.trim()
      : 'pending invitation';

  try {
    await removeProjectInvitation(projectIdValue, invitationIdValue);

    revalidatePath(returnPath);
    revalidatePath('/projects');
    redirect(`${returnPath}?status=success&message=${encodeURIComponent(`Cancelled pending invite for ${invitationLabel}`)}`);
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectInvitationRemovalErrorMessage(error))}`);
  }
}

export async function redeliverProjectInvitationAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const invitationIdValue = formData.get('invitationId');
  const invitationEmailValue = formData.get('invitationEmail');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project invitation delivery is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof invitationIdValue !== 'string'
    || invitationIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+pending+invitation+delivery`);
    return;
  }

  const invitationLabel =
    typeof invitationEmailValue === 'string' && invitationEmailValue.trim().length > 0
      ? invitationEmailValue.trim()
      : 'pending invitation';

  try {
    const result = await redeliverProjectInvitation(projectIdValue, invitationIdValue);

    revalidatePath(returnPath);
    revalidatePath('/projects');
    redirect(`${returnPath}?status=success&message=${encodeURIComponent(
      createInvitationDeliverySuccessMessage({
        email: invitationLabel,
        delivery: result.delivery,
        mode: 'redelivered'
      })
    )}`);
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectInvitationRedeliveryErrorMessage(error))}`);
  }
}

export async function removeProjectMemberAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const memberUserIdValue = formData.get('memberUserId');
  const memberEmailValue = formData.get('memberEmail');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project membership management is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof memberUserIdValue !== 'string'
    || memberUserIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+project+member+removal`);
    return;
  }

  const memberLabel =
    typeof memberEmailValue === 'string' && memberEmailValue.trim().length > 0
      ? memberEmailValue.trim()
      : 'project member';

  try {
    await removeProjectMember(projectIdValue, memberUserIdValue);

    revalidatePath(returnPath);
    revalidatePath('/projects');

    if (memberUserIdValue === viewer.userId) {
      redirect(`/projects?status=success&message=${encodeURIComponent(`Removed your access to ${memberLabel}`)}`);
    }

    redirect(`${returnPath}?status=success&message=${encodeURIComponent(`Removed ${memberLabel}`)}`);
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectMemberRemovalErrorMessage(error))}`);
  }
}

export async function transferProjectOwnershipAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const memberUserIdValue = formData.get('memberUserId');
  const memberEmailValue = formData.get('memberEmail');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project ownership transfer is temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (!viewer.user) {
    redirect(buildDashboardAccountSetupHref({
      redirectTo: returnPath
    }));
  }

  if (
    typeof projectIdValue !== 'string'
    || projectIdValue.length === 0
    || typeof memberUserIdValue !== 'string'
    || memberUserIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+project+ownership+transfer`);
    return;
  }

  const memberLabel =
    typeof memberEmailValue === 'string' && memberEmailValue.trim().length > 0
      ? memberEmailValue.trim()
      : 'project member';

  try {
    await transferProjectOwnership(projectIdValue, memberUserIdValue);

    revalidatePath(returnPath);
    revalidatePath('/projects');
    redirect(`${returnPath}?status=success&message=${encodeURIComponent(`Transferred project ownership to ${memberLabel}`)}`);
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectOwnershipTransferErrorMessage(error))}`);
  }
}

export async function triggerDeploymentAction(formData: FormData) {
  const projectIdValue = formData.get('projectId');
  const projectNameValue = formData.get('projectName');
  const serviceNameValue = formData.get('serviceName');

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect('/projects?status=error&message=Deploy+failed');
    return;
  }

  const projectId = projectIdValue;
  const projectName = normalizeProjectDisplayName(projectNameValue);
  const serviceName =
    typeof serviceNameValue === 'string' && serviceNameValue.trim().length > 0
      ? serviceNameValue.trim()
      : undefined;

  try {
    const deployment = await createDeployment(projectId, {
      ...(serviceName ? { serviceName } : {})
    });
    revalidatePath('/projects');
    revalidatePath('/deployments');
    redirect(`/deployments/${deployment.id}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const message = createDeploymentErrorMessage(statusCode, projectName);
    redirect(`/projects?status=error&message=${encodeURIComponent(message)}`);
  }
}
