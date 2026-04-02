'use client';

import { Button } from '@/components/ui/button';

interface TourPopoverProps {
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function TourPopover({
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: TourPopoverProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="w-72 space-y-3 rounded-lg border bg-card p-4 shadow-lg">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </p>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip} className="text-xs">
          Skip tour
        </Button>
        <div className="flex gap-1">
          {!isFirst && (
            <Button type="button" variant="outline" size="sm" onClick={onBack} className="text-xs">
              Back
            </Button>
          )}
          <Button type="button" size="sm" onClick={onNext} className="text-xs">
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
