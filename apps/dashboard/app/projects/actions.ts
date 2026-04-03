'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { createViewerContextFailureRedirect } from '@/lib/dashboard-action-auth';
import { buildDashboardAccountSetupHref } from '@/lib/dashboard-auth-navigation';
import {
  createProject,
  createProjectDomain,
  deleteProject,
  createDeployment,
  fetchProjectDomains,
  inviteProjectMember,
  redeliverProjectInvitation,
  removeProjectDomain,
  removeProjectInvitation,
  removeProjectMember,
  resolveViewerContext,
  transferProjectOwnership,
  updateProjectInvitation,
  updateProjectMemberRole,
  verifyProjectDomain
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
  const githubInstallationIdValue = formData.get('githubInstallationId');

  if (typeof nameValue !== 'string' || typeof gitRepositoryUrlValue !== 'string') {
    redirect('/projects?status=error&reason=invalid_input');
    return;
  }

  const name = nameValue.trim();
  const gitRepositoryUrl = gitRepositoryUrlValue.trim();
  const defaultBranch = typeof defaultBranchValue === 'string' ? defaultBranchValue.trim() : '';
  const slug = slugifyProjectName(name);
  const githubInstallationId = typeof githubInstallationIdValue === 'string' && githubInstallationIdValue.length > 0
    ? Number(githubInstallationIdValue)
    : undefined;

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
      ...(githubInstallationId ? { githubInstallationId } : {})
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

function createProjectDeletionErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project deletion is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'Only the current project owner or a platform admin can delete this project.';
  }

  if (statusCode === 404) {
    return 'That project no longer exists.';
  }

  if (statusCode === 409) {
    return 'This project still has queued, building, or running deployments. Stop or cancel them before deleting the project.';
  }

  if (statusCode === 503) {
    return 'Project deletion could not finish because a linked route or managed database resource could not be cleaned up right now. Retry shortly.';
  }

  return 'Failed to delete project.';
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

function createProjectDomainErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project domain management is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to manage project domains for this project.';
  }

  if (statusCode === 404) {
    return 'That project or domain record is no longer available.';
  }

  if (statusCode === 409) {
    return 'That domain is already in use or reserved by the platform.';
  }

  if (statusCode === 400) {
    return 'Enter a valid hostname without protocol or path, like api.example.com.';
  }

  return 'Failed to save project domain.';
}

function createProjectDomainRemovalErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project domain removal is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to remove project domains for this project.';
  }

  if (statusCode === 404) {
    return 'That domain claim no longer exists.';
  }

  if (statusCode === 409) {
    return 'Default platform hosts and domains attached to queued or building deployments cannot be removed until that deployment finishes or is cancelled.';
  }

  if (statusCode === 503) {
    return 'The live route could not be detached right now. Retry shortly.';
  }

  return 'Failed to remove project domain.';
}

function createProjectDomainDiagnosticsRefreshErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project domain diagnostics refresh is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to inspect project domains for this project.';
  }

  if (statusCode === 404) {
    return 'That project is no longer available.';
  }

  return 'Failed to refresh DNS and TLS checks.';
}

function createProjectDomainVerificationErrorMessage(error: unknown): string {
  const statusCode = extractApiStatusCode(error);

  if (statusCode === 401) {
    return 'Project domain verification is unauthorized. Sign in again with an active dashboard session and retry.';
  }

  if (statusCode === 403) {
    return 'You do not have permission to verify project domain claims for this project.';
  }

  if (statusCode === 404) {
    return 'That domain claim no longer exists.';
  }

  return 'Failed to verify the project domain claim.';
}

function createProjectDomainVerificationSuccessMessage(input: {
  host: string;
  verificationStatus?: 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
  claimState?: string;
}) {
  if (input.verificationStatus === 'verified' && input.claimState === 'healthy') {
    return `Verified ${input.host}; claim, routing, and HTTPS now look healthy.`;
  }

  if (input.verificationStatus === 'verified') {
    return `Verified ownership challenge for ${input.host}. Follow the next DNS/runtime step shown on the page.`;
  }

  if (input.verificationStatus === 'pending') {
    return `The ownership TXT record for ${input.host} is still pending. Publish it and verify again.`;
  }

  if (input.verificationStatus === 'mismatch') {
    return `The ownership TXT record for ${input.host} does not match the expected verification value yet.`;
  }

  return `Ownership verification for ${input.host} could not be completed right now. Retry shortly.`;
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

export async function createProjectDomainAction(formData: FormData) {
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
        fallbackMessage: 'Project domain management is temporarily unavailable. Check dashboard/API connectivity and retry.'
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
    redirect(`${returnPath}?status=error&message=Invalid+project+domain+request`);
    return;
  }

  const host = typeof formData.get('host') === 'string' ? String(formData.get('host')).trim() : '';
  if (host.length === 0) {
    redirect(`${returnPath}?status=error&message=Enter+a+valid+domain+host`);
    return;
  }

  try {
    const domain = await createProjectDomain(projectIdValue, { host });

    revalidatePath(returnPath);
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath('/projects');
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Added ${domain.host} as a pending custom domain claim`)}` 
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDomainErrorMessage(error))}`);
  }
}

export async function removeProjectDomainAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const domainIdValue = formData.get('domainId');
  const domainHostValue = formData.get('domainHost');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project domain management is temporarily unavailable. Check dashboard/API connectivity and retry.'
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
    || typeof domainIdValue !== 'string'
    || domainIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+project+domain+removal`);
    return;
  }

  const domainLabel =
    typeof domainHostValue === 'string' && domainHostValue.trim().length > 0
      ? domainHostValue.trim()
      : 'domain';

  try {
    await removeProjectDomain(projectIdValue, domainIdValue);

    revalidatePath(returnPath);
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath('/projects');
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(`Removed ${domainLabel} from this project`)}` 
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDomainRemovalErrorMessage(error))}`);
  }
}

export async function refreshProjectDomainDiagnosticsAction(formData: FormData) {
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
        fallbackMessage: 'Project domain diagnostics are temporarily unavailable. Check dashboard/API connectivity and retry.'
      })
    );
    return;
  }

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect(`${returnPath}?status=error&message=Invalid+project+domain+diagnostics+request`);
    return;
  }

  try {
    await fetchProjectDomains(projectIdValue, {
      includeDiagnostics: true
    });

    revalidatePath(returnPath);
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath('/projects');
    redirect(`${returnPath}?status=success&message=${encodeURIComponent('Refreshed DNS and TLS checks for this project')}`);
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDomainDiagnosticsRefreshErrorMessage(error))}`);
  }
}

export async function verifyProjectDomainClaimAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const domainIdValue = formData.get('domainId');
  const domainHostValue = formData.get('domainHost');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project domain verification is temporarily unavailable. Check dashboard/API connectivity and retry.'
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
    || typeof domainIdValue !== 'string'
    || domainIdValue.length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+project+domain+verification+request`);
    return;
  }

  const domainLabel =
    typeof domainHostValue === 'string' && domainHostValue.trim().length > 0
      ? domainHostValue.trim()
      : 'domain';

  try {
    const domain = await verifyProjectDomain(projectIdValue, domainIdValue);

    revalidatePath(returnPath);
    revalidatePath(`/projects/${projectIdValue}`);
    revalidatePath('/projects');
    redirect(
      `${returnPath}?status=success&message=${encodeURIComponent(createProjectDomainVerificationSuccessMessage({
        host: domain.host || domainLabel,
        verificationStatus: domain.verificationStatus,
        claimState: domain.claimState
      }))}`
    );
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDomainVerificationErrorMessage(error))}`);
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

export async function deleteProjectAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const projectIdValue = formData.get('projectId');
  const projectNameValue = formData.get('projectName');
  const confirmNameValue = formData.get('confirmName');
  const returnPath = normalizeActionReturnPath(formData.get('returnPath'));

  if (!viewer) {
    redirect(
      createViewerContextFailureRedirect({
        requestAuth,
        ...(viewerContextError ? { error: viewerContextError } : {}),
        redirectTo: returnPath,
        fallbackPath: returnPath,
        fallbackMessage: 'Project deletion is temporarily unavailable. Check dashboard/API connectivity and retry.'
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
    || typeof projectNameValue !== 'string'
    || projectNameValue.trim().length === 0
  ) {
    redirect(`${returnPath}?status=error&message=Invalid+project+deletion+request`);
    return;
  }

  const projectName = projectNameValue.trim();
  const confirmName = typeof confirmNameValue === 'string' ? confirmNameValue.trim() : '';

  if (confirmName !== projectName) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(`Type "${projectName}" exactly to confirm deletion`)}`);
    return;
  }

  try {
    await deleteProject(projectIdValue);

    revalidatePath('/projects');
    redirect(`/projects?status=success&message=${encodeURIComponent(`Deleted project "${projectName}"`)}`);
  } catch (error) {
    redirect(`${returnPath}?status=error&message=${encodeURIComponent(createProjectDeletionErrorMessage(error))}`);
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
