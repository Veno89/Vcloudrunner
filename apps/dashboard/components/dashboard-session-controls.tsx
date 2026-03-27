import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveViewerContext } from '@/lib/api';
import {
  buildDashboardAccountSetupHref,
  buildDashboardSignInHref
} from '@/lib/dashboard-auth-navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { getDashboardAuthTransport } from '@/lib/viewer-auth';
import { signOutDashboardSessionAction } from '@/app/sign-in/actions';

export async function DashboardSessionControls() {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, statusCode } = await resolveViewerContext();
  const authTransport = getDashboardAuthTransport(requestAuth);
  const hasSessionCookie = requestAuth.tokenSource === 'session-cookie';
  const hasExpiredSession = hasSessionCookie && statusCode === 401;
  const needsAccountSetup = Boolean(viewer && !viewer.user);
  const signInHref = buildDashboardSignInHref({
    ...(hasExpiredSession ? { reason: 'session-expired' as const } : {})
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={authTransport.variant}>{authTransport.label}</Badge>
      {hasExpiredSession ? (
        <Badge variant="destructive">session expired</Badge>
      ) : null}
      {needsAccountSetup ? (
        <Badge variant="warning">setup needed</Badge>
      ) : null}
      {viewer ? (
        <Badge variant="outline" className="max-w-[220px] truncate">
          {viewer.user?.name ?? viewer.user?.email ?? viewer.userId}
        </Badge>
      ) : null}
      {hasSessionCookie && !hasExpiredSession ? (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href={needsAccountSetup ? buildDashboardAccountSetupHref() : '/settings/account'}>
              {needsAccountSetup ? 'Finish Setup' : 'Account'}
            </Link>
          </Button>
          <form action={signOutDashboardSessionAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign Out
            </Button>
          </form>
        </>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={signInHref}>{hasExpiredSession ? 'Sign In Again' : 'Sign In'}</Link>
        </Button>
      )}
    </div>
  );
}
