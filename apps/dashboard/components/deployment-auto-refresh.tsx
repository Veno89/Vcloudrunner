'use client';

import type { DeploymentStatus } from '@vcloudrunner/shared-types';
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface DeploymentAutoRefreshProps {
  status: DeploymentStatus;
  intervalMs?: number;
}

export function DeploymentAutoRefresh({ status, intervalMs = 3000 }: DeploymentAutoRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const shouldRefresh = status === 'queued' || status === 'building';

  useEffect(() => {
    if (!shouldRefresh) {
      return;
    }

    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || isPending) {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs, isPending, router, shouldRefresh, startTransition]);

  if (!shouldRefresh) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground">
      Deployment is {status}. Auto-refreshing every {Math.round(intervalMs / 1000)}s when the tab is visible.
    </p>
  );
}
