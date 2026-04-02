'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useOnboarding } from '@/lib/onboarding/onboarding-context';
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps';

interface MilestoneDefinition {
  step: string;
  title: string;
  description: string;
}

const MILESTONES: MilestoneDefinition[] = [
  {
    step: ONBOARDING_STEPS.FIRST_PROJECT_CREATED,
    title: 'Project Created!',
    description: 'Your first project is ready. Configure services and deploy when you\'re set.',
  },
  {
    step: ONBOARDING_STEPS.FIRST_DEPLOY_TRIGGERED,
    title: 'First Deploy Triggered!',
    description: 'Your code is on its way. Watch the deployment logs for progress.',
  },
  {
    step: ONBOARDING_STEPS.FIRST_ENV_ADDED,
    title: 'Environment Variable Set!',
    description: 'Runtime config added. Redeploy to apply the change.',
  },
  {
    step: ONBOARDING_STEPS.FIRST_DOMAIN_ADDED,
    title: 'Custom Domain Added!',
    description: 'Add the verification TXT record to complete ownership verification.',
  },
  {
    step: ONBOARDING_STEPS.FIRST_DATABASE_PROVISIONED,
    title: 'Database Provisioned!',
    description: 'Your managed database is ready. Connection details are in project settings.',
  },
];

/**
 * Marks a milestone step as complete and shows a celebration toast.
 * Place this component on pages where the milestone naturally occurs.
 */
export function MilestoneTracker({ step }: { step: string }) {
  const { isStepComplete, markStepComplete } = useOnboarding();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (isStepComplete(step)) return;

    firedRef.current = true;
    markStepComplete(step);

    const milestone = MILESTONES.find((m) => m.step === step);
    if (milestone) {
      toast.success(milestone.title, {
        description: milestone.description,
        duration: 5000,
      });
    }
  }, [step, isStepComplete, markStepComplete]);

  return null;
}
