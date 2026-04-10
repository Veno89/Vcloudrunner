import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { DashboardSessionControls } from '@/components/dashboard-session-controls';
import { PlatformStatus } from '@/components/platform-status';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OnboardingProvider } from '@/lib/onboarding/onboarding-context';
import { KeyboardShortcuts } from '@/components/onboarding/keyboard-shortcuts';

export const metadata: Metadata = {
  title: 'Vcloudrunner',
  description: 'Deploy and manage Git-powered apps on your own infrastructure.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <OnboardingProvider>
          <TooltipProvider delayDuration={300}>
            <DashboardShell
              platformStatus={(
                <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted xl:flex-1" />}>
                  <PlatformStatus />
                </Suspense>
              )}
              sessionControls={(
                <Suspense fallback={<div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />}>
                  <DashboardSessionControls />
                </Suspense>
              )}
            >
              {children}
            </DashboardShell>
            <Toaster />
            <KeyboardShortcuts />
          </TooltipProvider>
        </OnboardingProvider>
      </body>
    </html>
  );
}
