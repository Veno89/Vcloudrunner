import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { signOutDashboardSessionAction } from '@/app/sign-in/actions';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { buildDashboardSignInHref } from '@/lib/dashboard-auth-navigation';
import type { DashboardAuthRequirement } from '@/lib/helpers';

interface DashboardAuthRequiredStateProps {
  requirement: DashboardAuthRequirement;
  redirectTo: string;
}

export function DashboardAuthRequiredState({
  requirement,
  redirectTo
}: DashboardAuthRequiredStateProps) {
  const signInHref = buildDashboardSignInHref({
    redirectTo,
    reason: requirement.kind
  });

  return (
    <EmptyState
      title={requirement.title}
      description={requirement.description}
      icon={<KeyRound className="h-4 w-4" aria-hidden />}
      actions={(
        <>
          <Button asChild size="sm">
            <Link href={signInHref}>{requirement.actionLabel}</Link>
          </Button>
          {requirement.kind === 'session-expired' ? (
            <form action={signOutDashboardSessionAction}>
              <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
              <Button type="submit" variant="outline" size="sm">
                Clear Session
              </Button>
            </form>
          ) : null}
        </>
      )}
    />
  );
}
