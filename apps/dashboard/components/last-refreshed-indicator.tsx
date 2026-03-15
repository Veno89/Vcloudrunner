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
  const refreshedIso = useMemo(() => {
    const parsed = new Date(refreshedAt);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  }, [refreshedAt]);
  const refreshedDisplay = useMemo(() => {
    const parsed = new Date(refreshedAt);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : undefined;
  }, [refreshedAt]);
  const [nowMs, setNowMs] = useState(() => (Number.isFinite(refreshedMs) ? refreshedMs : Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const hasValidRefreshTime = Number.isFinite(refreshedMs);
  const ageSeconds = hasValidRefreshTime
    ? Math.max(0, Math.floor((nowMs - refreshedMs) / 1000))
    : null;

  const stale = typeof ageSeconds === 'number' && ageSeconds > staleAfterSeconds;

  if (!hasValidRefreshTime || ageSeconds === null) {
    return (
      <p className={`text-xs text-muted-foreground ${className ?? ''}`} aria-live="polite">
        Last refreshed time unavailable.
      </p>
    );
  }

  return (
    <p className={`text-xs ${stale ? 'text-foreground' : 'text-muted-foreground'} ${className ?? ''}`} aria-live="polite">
      Last refreshed <time dateTime={refreshedIso} title={refreshedDisplay}>{formatAge(ageSeconds)} ago</time>.
      {stale ? ' Data may be stale; refresh if values look outdated.' : ''}
    </p>
  );
}
