import { Badge } from '@/components/ui/badge';

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface PlatformStatusStripProps {
  apiStatus: 'ok' | 'degraded' | 'unavailable';
  workerStatus: 'ok' | 'stale' | 'unavailable';
  queueStatus: 'ok' | 'degraded' | 'unavailable';
  queueCounts: QueueCounts;
  workerAgeMs?: number;
  lastSuccessfulDeployAt?: string;
}

function statusVariant(status: 'ok' | 'degraded' | 'stale' | 'unavailable') {
  if (status === 'ok') return 'success' as const;
  if (status === 'degraded' || status === 'stale') return 'warning' as const;
  return 'destructive' as const;
}

export function PlatformStatusStrip(props: PlatformStatusStripProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Platform Status</h2>
        <p className="text-xs text-muted-foreground">Operational heartbeat and queue pressure signals</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-md border px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">API</p>
          <div className="mt-1">
            <Badge variant={statusVariant(props.apiStatus)}>{props.apiStatus}</Badge>
          </div>
        </article>

        <article className="rounded-md border px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Worker</p>
          <div className="mt-1">
            <Badge variant={statusVariant(props.workerStatus)}>{props.workerStatus}</Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {typeof props.workerAgeMs === 'number' ? `Heartbeat age ${Math.round(props.workerAgeMs / 1000)}s` : 'No heartbeat telemetry'}
          </p>
        </article>

        <article className="rounded-md border px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Queue</p>
          <div className="mt-1">
            <Badge variant={statusVariant(props.queueStatus)}>{props.queueStatus}</Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            waiting {props.queueCounts.waiting} / active {props.queueCounts.active}
          </p>
        </article>

        <article className="rounded-md border px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last Successful Deploy</p>
          <p className="mt-1 text-sm font-semibold">
            {props.lastSuccessfulDeployAt ? new Date(props.lastSuccessfulDeployAt).toLocaleString() : 'None recorded'}
          </p>
          <p className="text-[11px] text-muted-foreground">failed {props.queueCounts.failed} / completed {props.queueCounts.completed}</p>
        </article>
      </div>
    </section>
  );
}
