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

function statusClass(status: 'ok' | 'degraded' | 'stale' | 'unavailable') {
  if (status === 'ok') {
    return 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200';
  }

  if (status === 'degraded' || status === 'stale') {
    return 'border-amber-700/60 bg-amber-950/30 text-amber-200';
  }

  return 'border-rose-700/60 bg-rose-950/30 text-rose-200';
}

export function PlatformStatusStrip(props: PlatformStatusStripProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Platform Status</h2>
        <p className="text-xs text-slate-400">Operational heartbeat and queue pressure signals</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className={`rounded border px-3 py-2 ${statusClass(props.apiStatus)}`}>
          <p className="text-[11px] uppercase tracking-wide opacity-90">API</p>
          <p className="mt-1 text-sm font-semibold">{props.apiStatus}</p>
        </article>

        <article className={`rounded border px-3 py-2 ${statusClass(props.workerStatus)}`}>
          <p className="text-[11px] uppercase tracking-wide opacity-90">Worker</p>
          <p className="mt-1 text-sm font-semibold">{props.workerStatus}</p>
          <p className="text-[11px] opacity-80">
            {typeof props.workerAgeMs === 'number' ? `Heartbeat age ${Math.round(props.workerAgeMs / 1000)}s` : 'No heartbeat telemetry'}
          </p>
        </article>

        <article className={`rounded border px-3 py-2 ${statusClass(props.queueStatus)}`}>
          <p className="text-[11px] uppercase tracking-wide opacity-90">Queue</p>
          <p className="mt-1 text-sm font-semibold">{props.queueStatus}</p>
          <p className="text-[11px] opacity-80">
            waiting {props.queueCounts.waiting} / active {props.queueCounts.active}
          </p>
        </article>

        <article className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Last Successful Deploy</p>
          <p className="mt-1 text-sm font-semibold">
            {props.lastSuccessfulDeployAt ? new Date(props.lastSuccessfulDeployAt).toLocaleString() : 'None recorded'}
          </p>
          <p className="text-[11px] text-slate-500">failed {props.queueCounts.failed} / completed {props.queueCounts.completed}</p>
        </article>
      </div>
    </section>
  );
}
