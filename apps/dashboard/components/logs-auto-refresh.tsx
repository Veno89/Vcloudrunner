'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface LogsAutoRefreshProps {
  enabled: boolean;
  intervalMs?: number;
}

export function LogsAutoRefresh({ enabled, intervalMs = 5000 }: LogsAutoRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || isPending) {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, isPending, router, startTransition]);

  return null;
}
