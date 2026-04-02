'use client';

import { TOURS } from '@/lib/onboarding/steps';
import { TourSpotlight } from './tour-spotlight';

export function ProjectTourClient() {
  const tour = TOURS.find((t) => t.id === 'project-setup-tour');
  if (!tour) return null;
  return <TourSpotlight tour={tour} />;
}
