'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TourPopover } from '@/components/onboarding/tour-popover';
import { useTour } from '@/lib/onboarding/use-tour';
import type { TourDefinition } from '@/lib/onboarding/steps';

interface TourSpotlightProps {
  tour: TourDefinition;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getPopoverPosition(
  target: TargetRect,
  side: 'top' | 'right' | 'bottom' | 'left' = 'bottom',
  popoverWidth: number,
  popoverHeight: number
): { top: number; left: number } {
  const gap = 12;

  switch (side) {
    case 'top':
      return {
        top: target.top - popoverHeight - gap,
        left: target.left + target.width / 2 - popoverWidth / 2,
      };
    case 'bottom':
      return {
        top: target.top + target.height + gap,
        left: target.left + target.width / 2 - popoverWidth / 2,
      };
    case 'left':
      return {
        top: target.top + target.height / 2 - popoverHeight / 2,
        left: target.left - popoverWidth - gap,
      };
    case 'right':
      return {
        top: target.top + target.height / 2 - popoverHeight / 2,
        left: target.left + target.width + gap,
      };
  }
}

export function TourSpotlight({ tour }: TourSpotlightProps) {
  const { isActive, currentStep, totalSteps, next, back, skip } = useTour(tour);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!isActive) return;
    const step = tour.steps[currentStep];
    if (!step) return;

    const element = document.querySelector(step.targetSelector);
    if (!element) {
      setTargetRect(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setTargetRect({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });

    // Scroll target into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isActive, currentStep, tour.steps]);

  useEffect(() => {
    updateTargetRect();
  }, [updateTargetRect]);

  // Recalculate on resize/scroll
  useEffect(() => {
    if (!isActive) return;

    const handleUpdate = () => updateTargetRect();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isActive, updateTargetRect]);

  // Trap escape key
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, skip]);

  if (!mounted || !isActive) return null;

  const step = tour.steps[currentStep];
  if (!step) return null;

  const padding = 6;
  const popoverWidth = 288; // w-72
  const popoverHeight = 180; // approximate

  const popoverPos = targetRect
    ? getPopoverPosition(
        {
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        },
        step.side ?? 'bottom',
        popoverWidth,
        popoverHeight
      )
    : { top: 100, left: 100 };

  // Clamp to viewport
  const clampedLeft = Math.max(8, Math.min(popoverPos.left, window.innerWidth - popoverWidth - 8));
  const clampedTop = Math.max(8, popoverPos.top);

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Overlay */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={6}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={skip}
        />
      </svg>

      {/* Highlight border */}
      {targetRect && (
        <div
          className="absolute rounded-md ring-2 ring-primary/50"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Popover */}
      <div
        ref={popoverRef}
        className="absolute z-[101]"
        style={{ top: clampedTop, left: clampedLeft }}
      >
        <TourPopover
          title={step.title}
          description={step.description}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={next}
          onBack={back}
          onSkip={skip}
        />
      </div>
    </div>,
    document.body
  );
}
