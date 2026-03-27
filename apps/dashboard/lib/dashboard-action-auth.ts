import type { DashboardRequestAuth } from './dashboard-session';
import { buildDashboardSignInHref } from './dashboard-auth-navigation';
import { getDashboardAuthRequirement } from './helpers';

interface ViewerContextFailureRedirectInput {
  requestAuth: DashboardRequestAuth;
  error?: unknown;
  redirectTo: string;
  fallbackPath: string;
  fallbackMessage: string;
}

export function createViewerContextFailureRedirect(
  input: ViewerContextFailureRedirectInput
): string {
  const authRequirement = getDashboardAuthRequirement({
    requestAuth: input.requestAuth,
    ...(input.error ? { error: input.error } : {})
  });

  if (authRequirement) {
    return buildDashboardSignInHref({
      redirectTo: input.redirectTo,
      reason: authRequirement.kind
    });
  }

  const joiner = input.fallbackPath.includes('?') ? '&' : '?';
  return `${input.fallbackPath}${joiner}status=error&message=${encodeURIComponent(input.fallbackMessage)}`;
}
