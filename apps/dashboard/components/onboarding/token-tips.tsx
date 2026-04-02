'use client';

import { HelpTip } from '@/components/help-tip';
import { TIPS } from '@/lib/onboarding/steps';

export function TokenScopesTip() {
  return <HelpTip label={TIPS.TOKEN_SCOPES.label} side="right" />;
}

export function TokenRotateTip() {
  return <HelpTip label={TIPS.TOKEN_ROTATE.label} side="top" />;
}

export function TokenExpirationTip() {
  return <HelpTip label={TIPS.TOKEN_EXPIRATION.label} side="top" />;
}
