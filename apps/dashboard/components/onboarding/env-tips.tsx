'use client';

import { HelpTip } from '@/components/help-tip';
import { TIPS } from '@/lib/onboarding/steps';

export function EnvExportTip() {
  return <HelpTip label={TIPS.ENV_EXPORT.label} side="right" />;
}

export function EnvImportTip() {
  return <HelpTip label={TIPS.ENV_IMPORT.label} side="right" />;
}

export function EnvMaskedTip() {
  return <HelpTip label={TIPS.ENV_MASKED.label} side="top" />;
}
