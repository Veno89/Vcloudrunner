'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnboarding } from '@/lib/onboarding/onboarding-context';
import type { TourDefinition } from '@/lib/onboarding/steps';

interface UseTourResult {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

export function useTour(tour: TourDefinition): UseTourResult {
  const { isTourDismissed, isStepComplete, dismissTour, markStepComplete } = useOnboarding();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const hasAutoStarted = useRef(false);

  const totalSteps = tour.steps.length;

  // Auto-start: if prerequisite is met, tour not dismissed/completed, and hasn't auto-started yet
  useEffect(() => {
    if (hasAutoStarted.current) return;
    if (isTourDismissed(tour.id)) return;
    if (isStepComplete(tour.id + '-completed')) return;
    if (tour.prerequisiteStep && !isStepComplete(tour.prerequisiteStep)) return;

    // Small delay to let the page render targets first
    const timer = setTimeout(() => {
      const firstTarget = document.querySelector(tour.steps[0]?.targetSelector ?? '');
      if (firstTarget) {
        hasAutoStarted.current = true;
        setIsActive(true);
        setCurrentStep(0);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [tour, isTourDismissed, isStepComplete]);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Tour complete
      markStepComplete(tour.id + '-completed');
      setIsActive(false);
    }
  }, [currentStep, totalSteps, markStepComplete, tour.id]);

  const back = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    dismissTour(tour.id);
    setIsActive(false);
  }, [dismissTour, tour.id]);

  return { isActive, currentStep, totalSteps, start, next, back, skip };
}
