import Link from 'next/link';
import { ActionToast } from '@/components/action-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSubmitButton } from '@/components/form-submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { SettingsSubnav } from '@/components/settings-subnav';
import {
  apiBaseUrl,
  resolveViewerContext
} from '@/lib/api';
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
import { signOutDashboardSessionAction } from '@/app/sign-in/actions';
import { saveViewerProfileAction } from './actions';

interface SettingsAccountPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
    redirectTo?: string;
  };
}

export default async function SettingsAccountPage({ searchParams }: SettingsAccountPageProps) {
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

        <DashboardUnavailableState
          title="Account unavailable"
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo="/settings/account"
        />
      </PageLayout>
    );
  }

  const scopeBadges = getViewerScopeLabels(viewer);
  const authTransport = getDashboardAuthTransport(requestAuth);
  const sessionSource = getViewerAuthSourceDetails(viewer.authSource);
  const redirectTo = normalizeDashboardRedirectTarget(searchParams?.redirectTo);
  const hasReturnTarget = redirectTo !== '/settings/account';

  return (
    <PageLayout>
      <PageHeader
        title="Account"
        description="Inspect the authenticated actor and current dashboard session."
      />

      <SettingsSubnav active="account" />

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Account update failed."
      />

      {!viewer.user && hasReturnTarget ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <p>
            Complete account setup to continue to <span className="font-mono text-foreground">{redirectTo}</span>.
          </p>
        </div>
      ) : null}

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
                : 'No persisted user record matched this actor yet, so the dashboard is showing the authenticated identity directly from the API auth context until account setup is completed.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {viewer.user ? 'Profile' : 'Complete Account Setup'}
            </CardTitle>
            <CardDescription>
              {viewer.user
                ? 'Keep the persisted profile for this authenticated actor up to date.'
                : 'Create the first persisted user profile for this authenticated actor so token-backed account workflows can move beyond bootstrap-only identity.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={saveViewerProfileAction} className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
              <div className="space-y-2">
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  name="name"
                  defaultValue={viewer.user?.name ?? ''}
                  placeholder="Platform Operator"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Email</Label>
                <Input
                  id="account-email"
                  name="email"
                  type="email"
                  defaultValue={viewer.user?.email ?? ''}
                  placeholder="operator@example.com"
                  required
                />
              </div>
              <FormSubmitButton
                idleText={viewer.user ? 'Save Profile' : 'Create Profile'}
                pendingText={viewer.user ? 'Saving...' : 'Creating...'}
              />
            </form>
            <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              {viewer.user
                ? 'This profile is now the persisted account identity used for DB-backed token ownership and future user/team workflows.'
                : 'Creating this profile turns the current authenticated actor into a persisted user record, unlocks normal DB-backed token management from this account, and automatically accepts any pending project invitations sent to the same email address.'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
              {viewer.user
                ? 'Token management is still the main first-class auth workflow today, and this account page now lets you keep both the browser session and persisted user profile aligned.'
                : 'Finish the profile setup above first, then move into DB-backed token management from the same account. If you were trying to reach another page, saving the profile will send you back there automatically.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {viewer.user ? (
                <Button asChild>
                  <Link href="/settings/tokens">Manage Tokens</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href={buildDashboardAccountSetupHref({
                    ...(hasReturnTarget ? { redirectTo } : {})
                  })}>Finish Profile Setup</Link>
                </Button>
              )}
              {viewer.user && hasReturnTarget ? (
                <Button asChild variant="outline">
                  <Link href={redirectTo}>Continue to Page</Link>
                </Button>
              ) : null}
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
