'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface LogsAutoRefreshProps {
  enabled: boolean;
  intervalMs?: number;
}

export function LogsAutoRefresh({ enabled, intervalMs = 5000 }: LogsAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
