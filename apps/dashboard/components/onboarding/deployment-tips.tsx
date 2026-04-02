'use client';

import { HelpTip } from '@/components/help-tip';
import { TIPS } from '@/lib/onboarding/steps';

export function DeploymentStatusTip() {
  return <HelpTip label={TIPS.DEPLOYMENT_STATUS.label} side="right" />;
}

export function RedeployTip() {
  return <HelpTip label={TIPS.REDEPLOY.label} side="top" />;
}

export function RollbackTip() {
  return <HelpTip label={TIPS.ROLLBACK.label} side="top" />;
}
