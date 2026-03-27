import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionToast } from '@/components/action-toast';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchProjectInvitationClaim,
  fetchViewerContext
} from '@/lib/api';
import {
  buildDashboardAccountSetupHref,
  buildDashboardSignInHref
} from '@/lib/dashboard-auth-navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { formatRelativeTime } from '@/lib/helpers';
import { acceptProjectInvitationClaimAction } from './actions';

interface InvitationClaimPageProps {
  params: {
    claimToken: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

function getInvitationStatusBadgeVariant(status: 'pending' | 'accepted' | 'cancelled') {
  if (status === 'accepted') {
    return 'success' as const;
  }

  if (status === 'cancelled') {
    return 'destructive' as const;
  }

  return 'warning' as const;
}

export default async function InvitationClaimPage({
  params,
  searchParams
}: InvitationClaimPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const invitationPath = `/invitations/${params.claimToken}`;
  let invitation: Awaited<ReturnType<typeof fetchProjectInvitationClaim>>;
  let viewer: Awaited<ReturnType<typeof fetchViewerContext>>;

  try {
    [invitation, viewer] = await Promise.all([
      fetchProjectInvitationClaim(params.claimToken),
      fetchViewerContext()
    ]);
  } catch (error) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          title="Invitation unavailable"
          requestAuth={requestAuth}
          error={error}
          redirectTo={invitationPath}
        />
      </PageLayout>
    );
  }

  if (!invitation) {
    notFound();
  }

  const normalizedViewerEmail = viewer?.user?.email.trim().toLowerCase() ?? null;
  const normalizedInvitationEmail = invitation.email.trim().toLowerCase();
  const viewerEmailMatches = normalizedViewerEmail === normalizedInvitationEmail;
  const claimedByViewer = invitation.acceptedByUser?.id === viewer?.userId;

  return (
    <PageLayout className="max-w-4xl">
      <PageHeader
        title="Project Invitation"
        description={`Claim access to ${invitation.projectName} or review the current invitation status.`}
      />

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Invitation claim failed."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitation Details</CardTitle>
            <CardDescription>
              This invite was created for <code>{invitation.email}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getInvitationStatusBadgeVariant(invitation.status)}>
                {invitation.status}
              </Badge>
              <Badge variant={invitation.role === 'admin' ? 'warning' : 'outline'}>
                {invitation.role}
              </Badge>
              <Badge variant="outline">{invitation.projectSlug}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Project</p>
                <p className="font-medium text-foreground">{invitation.projectName}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Invited email</p>
                <p className="font-medium text-foreground">{invitation.email}</p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Invited by</p>
              <p className="font-medium text-foreground">
                {invitation.invitedByUser
                  ? `${invitation.invitedByUser.name} (${invitation.invitedByUser.email})`
                  : 'Unknown inviter'}
              </p>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Created</p>
              <p className="text-foreground">{formatRelativeTime(invitation.createdAt)}</p>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Last updated</p>
              <p className="text-foreground">{formatRelativeTime(invitation.updatedAt)}</p>
            </div>

            {invitation.status === 'accepted' ? (
              <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                {invitation.acceptedByUser
                  ? claimedByViewer
                    ? `You already accepted this invitation ${formatRelativeTime(invitation.acceptedAt ?? invitation.updatedAt)}.`
                    : `This invitation was accepted by ${invitation.acceptedByUser.name} ${formatRelativeTime(invitation.acceptedAt ?? invitation.updatedAt)}.`
                  : 'This invitation has already been accepted.'}
              </p>
            ) : null}

            {invitation.status === 'cancelled' ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                This invitation was cancelled {formatRelativeTime(invitation.cancelledAt ?? invitation.updatedAt)}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Access</CardTitle>
            <CardDescription>
              Sign in with the invited account, then accept the invitation from this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {invitation.status === 'pending' && !viewer ? (
              <>
                <p className="text-muted-foreground">
                  No authenticated dashboard session is active yet.
                </p>
                <Button asChild>
                  <Link href={buildDashboardSignInHref({
                    redirectTo: invitationPath,
                    reason: 'sign-in-required'
                  })}>
                    Sign In to Claim
                  </Link>
                </Button>
              </>
            ) : null}

            {invitation.status === 'pending' && viewer && !viewer.user ? (
              <>
                <p className="text-muted-foreground">
                  This session is authenticated, but the actor still needs a persisted profile before invitation claims can finish.
                </p>
                <Button asChild>
                  <Link href={buildDashboardAccountSetupHref({
                    redirectTo: invitationPath
                  })}>
                    Complete Account Setup
                  </Link>
                </Button>
              </>
            ) : null}

            {invitation.status === 'pending' && viewer?.user && !viewerEmailMatches ? (
              <>
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-foreground">
                  Signed in as <span className="font-medium">{viewer.user.email}</span>, but this invitation was sent to <span className="font-medium">{invitation.email}</span>.
                </p>
                <Button asChild variant="outline">
                  <Link href={buildDashboardSignInHref({
                    redirectTo: invitationPath,
                    reason: 'access-denied'
                  })}>
                    Use Another Account
                  </Link>
                </Button>
              </>
            ) : null}

            {invitation.status === 'pending' && viewer?.user && viewerEmailMatches ? (
              <>
                <p className="text-muted-foreground">
                  Signed in as the invited account. Accepting this invite will add you to the project immediately.
                </p>
                <form action={acceptProjectInvitationClaimAction}>
                  <input type="hidden" name="claimToken" value={invitation.claimToken} readOnly />
                  <input type="hidden" name="returnPath" value={invitationPath} readOnly />
                  <FormSubmitButton
                    idleText={`Join ${invitation.projectName}`}
                    pendingText="Joining..."
                  />
                </form>
              </>
            ) : null}

            {invitation.status === 'accepted' ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/projects">Open Projects</Link>
                </Button>
                {claimedByViewer ? (
                  <Button asChild variant="outline">
                    <Link href={`/projects/${invitation.projectId}`}>Open Project</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {invitation.status === 'cancelled' ? (
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign In</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
