'use client';

import { HelpTip } from '@/components/help-tip';
import { TIPS } from '@/lib/onboarding/steps';

export function DomainAddTip() {
  return <HelpTip label={TIPS.DOMAIN_ADD.label} side="right" />;
}

export function DomainVerifyTip() {
  return <HelpTip label={TIPS.DOMAIN_VERIFY.label} side="top" />;
}
