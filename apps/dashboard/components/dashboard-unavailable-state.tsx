import type { DashboardRequestAuth } from '@/lib/dashboard-session';
import {
  describeDashboardLiveDataFailure,
  getDashboardAuthRequirement
} from '@/lib/helpers';
import { DashboardAuthRequiredState } from '@/components/dashboard-auth-required-state';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';

interface DashboardUnavailableStateProps {
  requestAuth: DashboardRequestAuth;
  error?: unknown;
  redirectTo: string;
  title?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function DashboardUnavailableState({
  requestAuth,
  error,
  redirectTo,
  title,
  actionHref,
  actionLabel
}: DashboardUnavailableStateProps) {
  const authRequirement = getDashboardAuthRequirement({
    requestAuth,
    ...(error ? { error } : {})
  });

  if (authRequirement) {
    return (
      <DashboardAuthRequiredState
        requirement={authRequirement}
        redirectTo={redirectTo}
      />
    );
  }

  return (
    <LiveDataUnavailableState
      title={title}
      description={describeDashboardLiveDataFailure({
        ...(error ? { error } : {}),
        hasDemoUserId: requestAuth.hasDemoUserId,
        hasApiAuthToken: requestAuth.hasBearerToken
      })}
      {...(actionHref ? { actionHref } : {})}
      {...(actionLabel ? { actionLabel } : {})}
    />
  );
}
