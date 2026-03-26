import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { SettingsSubnav } from '@/components/settings-subnav';
import {
  apiBaseUrl,
  resolveViewerContext
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { describeDashboardLiveDataFailure } from '@/lib/helpers';
import {
  getDashboardAuthTransport,
  getViewerAuthSourceDetails,
  getViewerScopeLabels
} from '@/lib/viewer-auth';
import { signOutDashboardSessionAction } from '@/app/sign-in/actions';

export default async function SettingsAccountPage() {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const hasSessionCookie = requestAuth.tokenSource === 'session-cookie';

  if (!viewer) {
    return (
      <PageLayout>
        <PageHeader
          title="Account"
          description="Inspect the authenticated actor and current dashboard session."
        />

        <SettingsSubnav active="account" />

        <LiveDataUnavailableState
          title="Account unavailable"
          description={describeDashboardLiveDataFailure({
            ...(viewerContextError ? { error: viewerContextError } : {}),
            hasDemoUserId: requestAuth.hasDemoUserId,
            hasApiAuthToken: requestAuth.hasBearerToken
          })}
          actionHref="/sign-in"
          actionLabel="Open Sign In"
        />
      </PageLayout>
    );
  }

  const scopeBadges = getViewerScopeLabels(viewer);
  const authTransport = getDashboardAuthTransport(requestAuth);
  const sessionSource = getViewerAuthSourceDetails(viewer.authSource);

  return (
    <PageLayout>
      <PageHeader
        title="Account"
        description="Inspect the authenticated actor and current dashboard session."
      />

      <SettingsSubnav active="account" />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolved Actor</CardTitle>
            <CardDescription>
              This is the live viewer identity returned by <code>/v1/auth/me</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">resolved</Badge>
              <Badge variant={viewer.role === 'admin' ? 'warning' : 'info'}>
                {viewer.role}
              </Badge>
              <Badge variant={sessionSource.variant}>{sessionSource.label}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium text-foreground">
                  {viewer.user?.name ?? 'No stored profile name'}
                </p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">
                  {viewer.user?.email ?? 'No stored profile email'}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">User ID</p>
              <p className="font-mono text-xs text-foreground">{viewer.userId}</p>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">Effective scopes</p>
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
            </div>

            <p className="text-xs text-muted-foreground">
              {viewer.user
                ? 'A persisted user record was found for this actor, so account identity can now be shown directly in the dashboard.'
                : 'No persisted user record matched this actor yet, so the dashboard is showing the authenticated identity directly from the API auth context.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Source</CardTitle>
            <CardDescription>
              The API now reports how this authenticated viewer was resolved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={sessionSource.variant}>{sessionSource.label}</Badge>
              <Badge variant={viewer.authMode === 'token' ? 'success' : 'warning'}>
                {sessionSource.modeLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground">{sessionSource.description}</p>
            <div className="space-y-1">
              <p className="text-muted-foreground">Auth mode</p>
              <p className="font-medium text-foreground">{viewer.authMode}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Auth source</p>
              <p className="font-mono text-xs text-foreground">{viewer.authSource}</p>
            </div>
            <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              {sessionSource.recommendation}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dashboard Request Path</CardTitle>
            <CardDescription>
              How the dashboard is currently sending credentials to the API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={authTransport.variant}>{authTransport.label}</Badge>
              <Badge variant="outline">viewer-context active</Badge>
            </div>
            <p className="text-muted-foreground">{authTransport.description}</p>
            <div className="space-y-1">
              <p className="text-muted-foreground">API base URL</p>
              <p className="font-mono text-xs text-foreground">{apiBaseUrl}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Viewer endpoint</p>
              <p className="font-mono text-xs text-foreground">GET /v1/auth/me</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Dev auth user hint</p>
              <p className="font-mono text-xs text-foreground">
                {requestAuth.demoUserId ?? 'not configured'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              The request transport above is dashboard configuration. The session source card reflects the authenticated state reported back by the API.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Actions</CardTitle>
            <CardDescription>
              Continue from this account surface into the current token-backed workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Token management is still the main first-class auth workflow today, but this account page now also lets you manage the browser session that the dashboard itself uses.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/settings/tokens">Manage Tokens</Link>
              </Button>
              {hasSessionCookie ? (
                <form action={signOutDashboardSessionAction}>
                  <Button type="submit" variant="outline">
                    Sign Out
                  </Button>
                </form>
              ) : (
                <Button asChild variant="outline">
                  <Link href="/sign-in">Create Session</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/settings">Back to Overview</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
