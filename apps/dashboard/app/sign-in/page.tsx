import Link from 'next/link';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PublicShell } from '@/components/public-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveViewerContext } from '@/lib/api';
import {
  buildDashboardAccountSetupHref,
  buildDashboardRegisterHref,
  normalizeDashboardRedirectTarget
} from '@/lib/dashboard-auth-navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import {
  getViewerAuthSourceDetails,
  getViewerScopeLabels
} from '@/lib/viewer-auth';
import {
  signInWithCredentialsAction,
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
  const shouldResolveViewer = requestAuth.tokenSource === 'session-cookie' || requestAuth.hasDemoUserId;
  const { viewer } = shouldResolveViewer ? await resolveViewerContext() : { viewer: null };
  const redirectTo = normalizeDashboardRedirectTarget(searchParams?.redirectTo);
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
  const returnButtonLabel = redirectTo !== '/settings/account' ? 'Continue to Workspace' : 'Open Account';
  const registerHref = buildDashboardRegisterHref({ plan: 'free', redirectTo });

  return (
    <PublicShell className="max-w-6xl">
      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Sign-in failed."
      />

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <Badge variant="info" className="bg-sky-400/10 text-sky-100">
            Operator access
          </Badge>

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Welcome back to your deployment control room.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300">
              Sign in with your email and password to jump back into projects, deployments,
              environment variables, logs, and the workspace you have already been using.
            </p>
          </div>

          {reasonMessage ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-slate-300 backdrop-blur">
              <p>{reasonMessage}</p>
              {redirectTo !== '/settings/account' ? (
                <p className="pt-2 text-xs text-slate-400">
                  After sign-in, we&apos;ll send you back to <span className="font-mono text-slate-200">{redirectTo}</span>.
                </p>
              ) : null}
            </div>
          ) : null}

          <Card className="border-white/10 bg-slate-950/75 shadow-[0_30px_80px_rgba(2,8,23,0.4)] backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Email &amp; Password</CardTitle>
              <CardDescription>
                Sign in with the credentials you registered with. Need an account?{' '}
                <Link href={registerHref} className="underline underline-offset-2">
                  Start with Free
                </Link>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={signInWithCredentialsAction} className="space-y-4">
                <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
                <div className="space-y-2">
                  <Label htmlFor="sign-in-email">Email</Label>
                  <Input
                    id="sign-in-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    className="border-white/10 bg-white/[0.03]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sign-in-password">Password</Label>
                  <Input
                    id="sign-in-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    required
                    minLength={8}
                    className="border-white/10 bg-white/[0.03]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FormSubmitButton
                    idleText="Sign In"
                    pendingText="Signing in..."
                    className="bg-sky-300 text-slate-950 hover:bg-sky-200"
                  />
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link href={redirectTo !== '/settings/account' ? redirectTo : '/settings/account'}>
                      {returnButtonLabel}
                    </Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card className="border-white/10 bg-white/[0.04] shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">
                {hasSessionCookie ? 'Replace Session Token' : 'Advanced API Token Sign-In'}
              </CardTitle>
              <CardDescription>
                Useful for bootstrap setup, automation, or admin recovery flows.
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
                    className="border-white/10 bg-white/[0.03]"
                  />
                </div>
                <FormSubmitButton
                  idleText={hasSessionCookie ? 'Replace Session' : 'Use Token'}
                  pendingText="Signing in..."
                  className="w-full bg-white/10 text-white hover:bg-white/15"
                />
              </form>
            </CardContent>
          </Card>

          {viewer ? (
            <Card className="border-white/10 bg-white/[0.04] shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl text-white">Resolved Viewer</CardTitle>
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
                  <p className="font-medium text-white">
                    {viewer.user?.name ?? viewer.user?.email ?? viewer.userId}
                  </p>
                  <p className="text-xs text-slate-400">
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
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
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
                        className="text-slate-200 hover:bg-white/10 hover:text-white"
                      />
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/10 bg-white/[0.04] shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl text-white">New here?</CardTitle>
                <CardDescription>
                  Start with the live Free plan and create a real account first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-sky-300 text-slate-950 hover:bg-sky-200">
                  <Link href={registerHref}>Create Free Account</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
