import { Activity, Clock3, Layers3, ServerCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  lastRunningDeployAt?: string;
}

function statusVariant(status: 'ok' | 'degraded' | 'stale' | 'unavailable') {
  if (status === 'ok') return 'success' as const;
  if (status === 'degraded' || status === 'stale') return 'warning' as const;
  return 'destructive' as const;
}

function statusSignalClassName(status: 'ok' | 'degraded' | 'stale' | 'unavailable') {
  if (status === 'ok') return 'status-signal-success';
  if (status === 'degraded' || status === 'stale') return 'status-signal-warning';
  return 'status-signal-destructive';
}

export function PlatformStatusStrip(props: PlatformStatusStripProps) {
  const cards = [
    {
      key: 'api',
      label: 'API',
      status: props.apiStatus,
      icon: Activity,
      detail: 'Gateway and dashboard API reachability'
    },
    {
      key: 'worker',
      label: 'Worker',
      status: props.workerStatus,
      icon: ServerCog,
      detail: typeof props.workerAgeMs === 'number'
        ? `Heartbeat age ${Math.round(props.workerAgeMs / 1000)}s`
        : 'No heartbeat telemetry'
    },
    {
      key: 'queue',
      label: 'Queue',
      status: props.queueStatus,
      icon: Layers3,
      detail: `waiting ${props.queueCounts.waiting} | active ${props.queueCounts.active}`
    },
    {
      key: 'recent',
      label: 'Latest Active Deploy',
      status: props.lastRunningDeployAt ? 'ok' : 'degraded',
      icon: Clock3,
      detail: props.lastRunningDeployAt
        ? new Date(props.lastRunningDeployAt).toLocaleString()
        : 'None currently running'
    }
  ] as const;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Platform status
          </p>
          <h2 className="font-display text-xl font-semibold tracking-tight text-white">Operational heartbeat at a glance.</h2>
        </div>
        <p className="max-w-xl text-xs leading-6 text-slate-400">
          Watch API reachability, worker freshness, queue pressure, and active deployments without leaving the current page.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {cards.map(({ key, label, status, icon: Icon, detail }) => (
          <article
            key={key}
            className="rounded-[1.75rem] border border-white/10 bg-slate-950/58 p-4 shadow-[0_18px_48px_rgba(2,6,23,0.25)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', statusSignalClassName(status))} />
                  <Badge variant={statusVariant(status)} className="border-white/5 uppercase tracking-[0.18em]">
                    {status}
                  </Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300">{detail}</p>
            {key === 'recent' ? (
              <p className="mt-2 text-[11px] text-slate-500">
                failed {props.queueCounts.failed} | completed {props.queueCounts.completed}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
