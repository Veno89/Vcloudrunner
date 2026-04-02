'use client';

import { Lightbulb } from 'lucide-react';
import { useOnboarding } from '@/lib/onboarding/onboarding-context';

interface FeatureHintProps {
  tipId: string;
  children: React.ReactNode;
}

/**
 * Inline hint that appears once and can be dismissed.
 * Ideal for subtle discovery cues near features users haven't tried yet.
 */
export function FeatureHint({ tipId, children }: FeatureHintProps) {
  const { isTooltipDismissed, dismissTooltip } = useOnboarding();

  if (isTooltipDismissed(tipId)) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="flex-1">{children}</div>
      <button
        type="button"
        onClick={() => dismissTooltip(tipId)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss hint"
      >
        ✕
      </button>
    </div>
  );
}
