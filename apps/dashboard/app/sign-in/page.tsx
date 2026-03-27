import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { resolveViewerContext } from '@/lib/api';
import {
  buildDashboardAccountSetupHref,
  normalizeDashboardRedirectTarget
} from '@/lib/dashboard-auth-navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import {
  getDashboardAuthTransport,
  getViewerAuthSourceDetails,
  getViewerScopeLabels
} from '@/lib/viewer-auth';
import {
  signInWithApiTokenAction,
  signOutDashboardSessionAction
} from './actions';

interface SignInPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
    redirectTo?: string;
    reason?: 'sign-in-required' | 'session-expired' | 'access-denied';
  };
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer } = await resolveViewerContext();
  const redirectTo = normalizeDashboardRedirectTarget(searchParams?.redirectTo);
  const authTransport = getDashboardAuthTransport(requestAuth);
  const scopeBadges = viewer ? getViewerScopeLabels(viewer) : [];
  const viewerAuthSource = viewer
    ? getViewerAuthSourceDetails(viewer.authSource)
    : null;
  const needsAccountSetup = Boolean(viewer && !viewer.user);
  const hasSessionCookie = requestAuth.tokenSource === 'session-cookie';
  const reasonMessage =
    searchParams?.reason === 'session-expired'
      ? 'Your previous session expired or was rejected. Sign in again to continue where you left off.'
      : searchParams?.reason === 'access-denied'
        ? 'This page needs a different token or wider access. Sign in with another API token to continue.'
        : searchParams?.reason === 'sign-in-required'
          ? 'This part of the dashboard now requires an authenticated session.'
          : null;
  const returnButtonLabel = redirectTo !== '/settings/account' ? 'Back to Page' : 'Open Account';

  return (
    <PageLayout className="max-w-3xl">
      <PageHeader
        title="Sign In"
        description="Start a dashboard session with an API token, then complete account setup if this actor does not have a stored profile yet."
      />

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Sign-in failed."
      />

      {reasonMessage ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <p>{reasonMessage}</p>
          {redirectTo !== '/settings/account' ? (
            <p className="pt-1 text-xs">
              After sign-in, we&apos;ll send you back to <span className="font-mono text-foreground">{redirectTo}</span>.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {hasSessionCookie ? 'Replace Session Token' : 'Create Session'}
            </CardTitle>
            <CardDescription>
              The token is stored in an httpOnly cookie and used for server-side dashboard API requests in this browser session. DB-backed tokens are preferred, but bootstrap tokens can still be used as a bridge into account setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signInWithApiTokenAction} className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
              <div className="space-y-2">
                <Label htmlFor="dashboard-api-token">API token</Label>
                <Input
                  id="dashboard-api-token"
                  name="token"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste an API token"
                  required
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FormSubmitButton
                  idleText={hasSessionCookie ? 'Replace Session' : 'Sign In'}
                  pendingText="Signing in..."
                />
                <Button asChild variant="outline">
                  <Link href={redirectTo !== '/settings/account' ? redirectTo : '/settings/account'}>
                    {returnButtonLabel}
                  </Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Request Path</CardTitle>
            <CardDescription>
              This is how the dashboard is authenticating requests right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={authTransport.variant}>{authTransport.label}</Badge>
              {viewerAuthSource ? (
                <Badge variant={viewerAuthSource.variant}>{viewerAuthSource.label}</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground">{authTransport.description}</p>
            {requestAuth.tokenSource === 'server-env-token' ? (
              <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                A shared server environment token is currently active. Signing in here will override that fallback for this browser with a per-user session cookie.
              </p>
            ) : null}
            {requestAuth.transport === 'dev-user-header' ? (
              <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                Local dev auth is active. You can still sign in with a DB-backed token to test the real session path, or finish account setup first if this actor still only exists as dev/bootstrap identity.
              </p>
            ) : null}
            {needsAccountSetup ? (
              <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                The current actor is authenticated but does not have a persisted user profile yet. Complete account setup before expecting DB-backed token and project-creation workflows to behave like a normal stored user.
              </p>
            ) : null}
            {redirectTo !== '/settings/account' ? (
              <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                Return target after sign-in: <span className="font-mono text-foreground">{redirectTo}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {viewer ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolved Viewer</CardTitle>
            <CardDescription>
              The current request already resolves to this actor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">resolved</Badge>
              <Badge variant={viewer.role === 'admin' ? 'warning' : 'info'}>
                {viewer.role}
              </Badge>
              {needsAccountSetup ? (
                <Badge variant="warning">profile setup needed</Badge>
              ) : null}
              {viewerAuthSource ? (
                <Badge variant={viewerAuthSource.variant}>{viewerAuthSource.modeLabel}</Badge>
              ) : null}
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {viewer.user?.name ?? viewer.user?.email ?? viewer.userId}
              </p>
              <p className="text-xs text-muted-foreground">
                {viewer.user?.email ?? viewer.userId}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {scopeBadges.map((scope) => (
                <Badge
                  key={scope}
                  variant={scope === '*' ? 'warning' : 'outline'}
                  className="font-mono text-[10px]"
                >
                  {scope}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {needsAccountSetup ? (
                <Button asChild>
                  <Link href={buildDashboardAccountSetupHref({
                    ...(redirectTo !== '/settings/account' ? { redirectTo } : {})
                  })}>
                    Complete Account Setup
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href={redirectTo !== '/settings/account' ? redirectTo : '/settings/account'}>
                  {returnButtonLabel}
                </Link>
              </Button>
              {hasSessionCookie ? (
                <form action={signOutDashboardSessionAction}>
                  <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
                  <FormSubmitButton
                    idleText="Sign Out"
                    pendingText="Signing out..."
                    variant="ghost"
                  />
                </form>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PageLayout>
  );
}
