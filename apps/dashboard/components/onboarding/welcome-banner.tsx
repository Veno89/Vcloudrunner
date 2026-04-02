'use client';

import { Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/lib/onboarding/onboarding-context';
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps';

interface WelcomeBannerProps {
  onGetStarted?: () => void;
}

export function WelcomeBanner({ onGetStarted }: WelcomeBannerProps) {
  const { isStepComplete, markStepComplete } = useOnboarding();

  if (isStepComplete(ONBOARDING_STEPS.WELCOME_SEEN)) {
    return null;
  }

  function handleDismiss() {
    markStepComplete(ONBOARDING_STEPS.WELCOME_SEEN);
  }

  function handleGetStarted() {
    markStepComplete(ONBOARDING_STEPS.WELCOME_SEEN);
    onGetStarted?.();
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="space-y-3">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
          <Rocket className="h-4 w-4" aria-hidden />
        </div>
        <CardTitle className="text-base">Welcome to Vcloudrunner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vcloudrunner takes a Git repository, builds it in Docker, and runs it on your machine.
          You can manage projects, deployments, environment variables, custom domains, managed databases, and more — all from this dashboard.
        </p>
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Get started in three steps:</p>
          <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
            <li>Create a project with your Git repository URL</li>
            <li>Add environment variables your app needs</li>
            <li>Deploy and watch the build logs</li>
          </ol>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleGetStarted}>
            Get Started
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
