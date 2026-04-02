'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/lib/onboarding/onboarding-context';
import { TOURS } from '@/lib/onboarding/steps';

export function OnboardingSettingsClient() {
  const { profile, resetAll } = useOnboarding();
  const router = useRouter();

  function handleReplayTour(tourId: string, routePrefix: string) {
    // Un-dismiss the tour so it auto-starts on the route
    // We need to remove it from dismissed; resetAll is too broad
    // Instead navigate to the route and let the tour hook handle it
    // Clear just this tour's dismissal
    const tour = TOURS.find((t) => t.id === tourId);
    if (!tour) return;

    // The tour will auto-start if it's not dismissed. If it IS dismissed, we un-dismiss it here.
    // We use a reset approach: clear dismissed state, then navigate
    if (profile.dismissedTours.includes(tourId)) {
      // Remove from dismissed by re-dismissing all other tours except this one
      // Actually, the simplest approach: we need an undismiss. Let's call resetAll then navigate.
      // But that resets everything. Better: we'll just navigate; if the user wants to replay
      // a specific tour, we trigger the start manually by removing its dismissed flag.
      // Since OnboardingProvider doesn't expose undismiss, let's just reset all and navigate.
      resetAll();
    }

    router.push(routePrefix);
  }

  function handleResetAll() {
    resetAll();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Available Tours</p>
        {TOURS.map((tour) => {
          const isDismissed = profile.dismissedTours.includes(tour.id);
          return (
            <div
              key={tour.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{tour.label}</p>
                <p className="text-xs text-muted-foreground">{tour.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReplayTour(tour.id, tour.routePrefix)}
              >
                {isDismissed ? 'Replay Tour' : 'Start Tour'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <Button variant="outline" size="sm" onClick={handleResetAll}>
          Reset All Onboarding
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          This will re-show the welcome banner, all tours, and all tooltip hints.
        </p>
      </div>
    </div>
  );
}
