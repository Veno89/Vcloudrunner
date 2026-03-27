import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { SettingsSubnav } from '@/components/settings-subnav';
import {
  resolveViewerContext
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { getViewerAuthSourceDetails } from '@/lib/viewer-auth';

export default async function SettingsPage() {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();
  const hasSessionCookie = requestAuth.tokenSource === 'session-cookie';

  if (!viewer) {
    return (
      <PageLayout>
        <PageHeader
          title="Settings"
          description="Manage account and platform-level configuration."
        />

        <SettingsSubnav active="overview" />

        <DashboardUnavailableState
          title="Settings unavailable"
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo="/settings"
        />
      </PageLayout>
    );
  }

  const sessionSource = getViewerAuthSourceDetails(viewer.authSource);
  const resolvedIdentity = viewer.user?.name ?? viewer.user?.email ?? viewer.userId;
  const accountCtaHref = '/settings/account';
  const accountCtaLabel = viewer.user
    ? 'Open Account'
    : 'Complete Account Setup';

  return (
    <PageLayout>
      <PageHeader
        title="Settings"
        description="Manage account and platform-level configuration."
      />

      <SettingsSubnav active="overview" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account & Session</CardTitle>
            <CardDescription>
              {viewer.user
                ? 'The dashboard now resolves this actor live from the API instead of assuming a hardcoded demo user.'
                : 'This actor is authenticated, but account setup still needs to create the persisted user profile behind it.'}
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
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Current actor</p>
              <p className="font-medium text-foreground">{resolvedIdentity}</p>
              {viewer.user?.email ? (
                <p className="text-xs text-muted-foreground">{viewer.user.email}</p>
              ) : (
                <p className="font-mono text-xs text-muted-foreground">{viewer.userId}</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{sessionSource.description}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={accountCtaHref}>{accountCtaLabel}</Link>
              </Button>
              {!hasSessionCookie ? (
                <Button asChild variant="outline">
                  <Link href="/sign-in">Create Session</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Tokens</CardTitle>
            <CardDescription>
              {viewer.user
                ? 'Manage the token lifecycle for the currently resolved viewer.'
                : 'Complete account setup before moving into normal DB-backed token management.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {viewer.user
                ? 'Create, rotate, and revoke DB-backed API tokens for this account. These tokens are the preferred live auth path once you move past bootstrap or local dev-auth flows.'
                : 'DB-backed tokens belong to persisted users. Finish account setup first so this authenticated actor can move out of bootstrap/dev identity and into the normal token lifecycle.'}
            </p>
            <Button asChild variant="outline">
              <Link href={viewer.user ? '/settings/tokens' : '/settings/account'}>
                {viewer.user ? 'Open Tokens' : 'Finish Account Setup'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
