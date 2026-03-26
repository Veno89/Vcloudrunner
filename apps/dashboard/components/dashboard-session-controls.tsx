import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveViewerContext } from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { getDashboardAuthTransport } from '@/lib/viewer-auth';
import { signOutDashboardSessionAction } from '@/app/sign-in/actions';

export async function DashboardSessionControls() {
  const requestAuth = getDashboardRequestAuth();
  const { viewer } = await resolveViewerContext();
  const authTransport = getDashboardAuthTransport(requestAuth);
  const hasSessionCookie = requestAuth.tokenSource === 'session-cookie';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={authTransport.variant}>{authTransport.label}</Badge>
      {viewer ? (
        <Badge variant="outline" className="max-w-[220px] truncate">
          {viewer.user?.name ?? viewer.user?.email ?? viewer.userId}
        </Badge>
      ) : null}
      {hasSessionCookie ? (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings/account">Account</Link>
          </Button>
          <form action={signOutDashboardSessionAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign Out
            </Button>
          </form>
        </>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href="/sign-in">Sign In</Link>
        </Button>
      )}
    </div>
  );
}
