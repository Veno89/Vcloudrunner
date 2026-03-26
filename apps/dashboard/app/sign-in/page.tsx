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
  };
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer } = await resolveViewerContext();
  const authTransport = getDashboardAuthTransport(requestAuth);
  const scopeBadges = viewer ? getViewerScopeLabels(viewer) : [];
  const viewerAuthSource = viewer
    ? getViewerAuthSourceDetails(viewer.authSource)
    : null;
  const hasSessionCookie = requestAuth.tokenSource === 'session-cookie';

  return (
    <PageLayout className="max-w-3xl">
      <PageHeader
        title="Sign In"
        description="Start a per-user dashboard session with a DB-backed API token."
      />

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Sign-in failed."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {hasSessionCookie ? 'Replace Session Token' : 'Create Session'}
            </CardTitle>
            <CardDescription>
              The token is stored in an httpOnly cookie and used for server-side dashboard API requests in this browser session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signInWithApiTokenAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dashboard-api-token">API token</Label>
                <Input
                  id="dashboard-api-token"
                  name="token"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste a DB-backed API token"
                  required
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FormSubmitButton
                  idleText={hasSessionCookie ? 'Replace Session' : 'Sign In'}
                  pendingText="Signing in..."
                />
                <Button asChild variant="outline">
                  <Link href="/settings/account">Open Account</Link>
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
                Local dev auth is active. You can still sign in with a DB-backed token to test the real session path.
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
              <Button asChild variant="outline">
                <Link href="/settings/account">Open Account</Link>
              </Button>
              {hasSessionCookie ? (
                <form action={signOutDashboardSessionAction}>
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
