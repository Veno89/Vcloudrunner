'use client';

import type { DeploymentStatus } from '@vcloudrunner/shared-types';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DeploymentAutoRefreshProps {
  status: DeploymentStatus;
  intervalMs?: number;
}

export function DeploymentAutoRefresh({ status, intervalMs = 3000 }: DeploymentAutoRefreshProps) {
  const router = useRouter();
  const shouldRefresh = status === 'queued' || status === 'building';

  useEffect(() => {
    if (!shouldRefresh) {
      return;
    }

    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs, router, shouldRefresh]);

  if (!shouldRefresh) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground">
      Deployment is {status}. Auto-refreshing every {Math.round(intervalMs / 1000)}s.
    </p>
  );
}
