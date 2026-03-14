'use client';

import { useEffect, useMemo, useState } from 'react';

interface LastRefreshedIndicatorProps {
  refreshedAt: string;
  staleAfterSeconds?: number;
  className?: string;
}

function formatAge(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

export function LastRefreshedIndicator({
  refreshedAt,
  staleAfterSeconds = 20,
  className,
}: LastRefreshedIndicatorProps) {
  const refreshedMs = useMemo(() => Date.parse(refreshedAt), [refreshedAt]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ageSeconds = Number.isFinite(refreshedMs)
    ? Math.max(0, Math.floor((nowMs - refreshedMs) / 1000))
    : 0;

  const stale = ageSeconds > staleAfterSeconds;

  return (
    <p className={`text-xs ${stale ? 'text-amber-600' : 'text-muted-foreground'} ${className ?? ''}`}>
      Last refreshed {formatAge(ageSeconds)} ago.
      {stale ? ' Data may be stale; refresh if values look outdated.' : ''}
    </p>
  );
}
