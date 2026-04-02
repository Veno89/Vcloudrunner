'use client';

import { Lightbulb, X } from 'lucide-react';
import { useOnboarding } from '@/lib/onboarding/onboarding-context';

interface GuidanceCardProps {
  /** Unique ID used to track dismissal via onboarding state. */
  tipId: string;
  /** Short heading for the guidance. */
  title: string;
  /** Body text or elements. */
  children: React.ReactNode;
}

export function GuidanceCard({ tipId, title, children }: GuidanceCardProps) {
  const { isTooltipDismissed, dismissTooltip } = useOnboarding();

  if (isTooltipDismissed(tipId)) {
    return null;
  }

  return (
    <div className="relative rounded-md border border-info/30 bg-info/5 p-3">
      <button
        type="button"
        onClick={() => dismissTooltip(tipId)}
        className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label="Dismiss tip"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--info-foreground))]" aria-hidden />
        <div className="space-y-1 pr-4">
          <p className="text-xs font-medium text-foreground">{title}</p>
          <div className="text-xs text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
