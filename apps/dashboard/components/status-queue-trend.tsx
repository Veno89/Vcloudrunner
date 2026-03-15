'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface QueueSample {
  timestamp: string;
  waiting: number;
  active: number;
  failed: number;
}

const MAX_SAMPLES = 12;

function formatTimeLabel(timestamp: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return '--:--';
  }

  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function StatusQueueTrend() {
  const [samples, setSamples] = useState<QueueSample[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'degraded'>('loading');

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        const response = await fetch('/api/queue-health', { cache: 'no-store' });
        const payload = await response.json() as {
          status?: 'ok' | 'degraded' | 'unavailable';
          counts?: { waiting?: number; active?: number; failed?: number };
        };

        const nextStatus = payload.status === 'ok' ? 'ok' : 'degraded';
        const sample: QueueSample = {
          timestamp: new Date().toISOString(),
          waiting: payload.counts?.waiting ?? 0,
          active: payload.counts?.active ?? 0,
          failed: payload.counts?.failed ?? 0,
        };

        if (cancelled) {
          return;
        }

        setStatus(nextStatus);
        setSamples((previous) => [...previous, sample].slice(-MAX_SAMPLES));
      } catch {
        if (!cancelled) {
          setStatus('degraded');
        }
      }
    };

    loadSnapshot();
    const id = window.setInterval(loadSnapshot, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const maxDepth = useMemo(
    () => Math.max(1, ...samples.map((sample) => sample.waiting + sample.active)),
    [samples]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Live queue-depth trend (10s sampling)</p>
        <Badge variant={status === 'ok' ? 'success' : status === 'loading' ? 'warning' : 'destructive'}>
          {status}
        </Badge>
      </div>

      {samples.length === 0 ? (
        <p className="text-sm text-muted-foreground">Collecting queue samples...</p>
      ) : (
        <div className="space-y-2">
          {samples.map((sample) => {
            const depth = sample.waiting + sample.active;
            const width = Math.max(6, Math.round((depth / maxDepth) * 100));

            return (
              <div key={sample.timestamp} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{formatTimeLabel(sample.timestamp)}</span>
                  <span>depth {depth} (w:{sample.waiting} / a:{sample.active} / f:{sample.failed})</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
