'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'vcloudrunner_onboarding';

export interface OnboardingProfile {
  completedSteps: string[];
  dismissedTours: string[];
  dismissedTooltips: string[];
  firstSeenAt: string;
}

interface OnboardingContextValue {
  profile: OnboardingProfile;
  isStepComplete: (step: string) => boolean;
  isTourDismissed: (tour: string) => boolean;
  isTooltipDismissed: (id: string) => boolean;
  markStepComplete: (step: string) => void;
  dismissTour: (tour: string) => void;
  dismissTooltip: (id: string) => void;
  resetAll: () => void;
}

function createDefaultProfile(): OnboardingProfile {
  return {
    completedSteps: [],
    dismissedTours: [],
    dismissedTooltips: [],
    firstSeenAt: new Date().toISOString(),
  };
}

function loadProfile(): OnboardingProfile {
  if (typeof window === 'undefined') return createDefaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
    return {
      completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
      dismissedTours: Array.isArray(parsed.dismissedTours) ? parsed.dismissedTours : [],
      dismissedTooltips: Array.isArray(parsed.dismissedTooltips) ? parsed.dismissedTooltips : [],
      firstSeenAt: typeof parsed.firstSeenAt === 'string' ? parsed.firstSeenAt : new Date().toISOString(),
    };
  } catch {
    return createDefaultProfile();
  }
}

function persistProfile(profile: OnboardingProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage may be unavailable (e.g. private browsing quota exceeded)
  }
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile>(createDefaultProfile);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const updateProfile = useCallback((updater: (prev: OnboardingProfile) => OnboardingProfile) => {
    setProfile((prev) => {
      const next = updater(prev);
      persistProfile(next);
      return next;
    });
  }, []);

  const isStepComplete = useCallback(
    (step: string) => profile.completedSteps.includes(step),
    [profile.completedSteps]
  );

  const isTourDismissed = useCallback(
    (tour: string) => profile.dismissedTours.includes(tour),
    [profile.dismissedTours]
  );

  const isTooltipDismissed = useCallback(
    (id: string) => profile.dismissedTooltips.includes(id),
    [profile.dismissedTooltips]
  );

  const markStepComplete = useCallback(
    (step: string) => {
      updateProfile((prev) =>
        prev.completedSteps.includes(step)
          ? prev
          : { ...prev, completedSteps: [...prev.completedSteps, step] }
      );
    },
    [updateProfile]
  );

  const dismissTour = useCallback(
    (tour: string) => {
      updateProfile((prev) =>
        prev.dismissedTours.includes(tour)
          ? prev
          : { ...prev, dismissedTours: [...prev.dismissedTours, tour] }
      );
    },
    [updateProfile]
  );

  const dismissTooltip = useCallback(
    (id: string) => {
      updateProfile((prev) =>
        prev.dismissedTooltips.includes(id)
          ? prev
          : { ...prev, dismissedTooltips: [...prev.dismissedTooltips, id] }
      );
    },
    [updateProfile]
  );

  const resetAll = useCallback(() => {
    const fresh = createDefaultProfile();
    persistProfile(fresh);
    setProfile(fresh);
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      profile,
      isStepComplete,
      isTourDismissed,
      isTooltipDismissed,
      markStepComplete,
      dismissTour,
      dismissTooltip,
      resetAll,
    }),
    [profile, isStepComplete, isTourDismissed, isTooltipDismissed, markStepComplete, dismissTour, dismissTooltip, resetAll]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
