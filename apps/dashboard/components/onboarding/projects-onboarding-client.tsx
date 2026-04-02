'use client';

import { WelcomeBanner } from '@/components/onboarding/welcome-banner';
import { GuidanceCard } from '@/components/onboarding/guidance-card';
import { MilestoneTracker } from '@/components/onboarding/milestone-tracker';
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps';

interface ProjectsOnboardingClientProps {
  hasProjects: boolean;
}

export function ProjectsOnboardingClient({ hasProjects }: ProjectsOnboardingClientProps) {
  return (
    <>
      <WelcomeBanner />
      {hasProjects && <MilestoneTracker step={ONBOARDING_STEPS.FIRST_PROJECT_CREATED} />}
      {!hasProjects && (
        <GuidanceCard tipId="projects-empty-guide" title="How to get started">
          <ol className="list-inside list-decimal space-y-0.5">
            <li>Click <strong>New Project</strong> above to create a project with your Git repo</li>
            <li>Navigate to <strong>Environment</strong> to add runtime variables</li>
            <li>Hit <strong>Deploy</strong> and watch the build logs</li>
          </ol>
        </GuidanceCard>
      )}
    </>
  );
}
