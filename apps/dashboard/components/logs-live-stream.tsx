'use client';

import { useEffect, useMemo, useState } from 'react';

interface LogItem {
  level: string;
  message: string;
  timestamp: string;
}

interface LogsLiveStreamProps {
  projectId: string;
  deploymentId: string;
  initialLogs: LogItem[];
}

export function LogsLiveStream({ projectId, deploymentId, initialLogs }: LogsLiveStreamProps) {
  const [logs, setLogs] = useState<LogItem[]>(initialLogs);
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');

  const initialAfter = useMemo(() => {
    if (initialLogs.length === 0) {
      return '';
    }

    return initialLogs[initialLogs.length - 1]?.timestamp ?? '';
  }, [initialLogs]);

  useEffect(() => {
    setLogs(initialLogs);
    setStatus('connecting');

    const streamUrl = new URL('/api/log-stream', window.location.origin);
    streamUrl.searchParams.set('projectId', projectId);
    streamUrl.searchParams.set('deploymentId', deploymentId);

    if (initialAfter) {
      streamUrl.searchParams.set('after', initialAfter);
    }

    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      setStatus('live');
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as LogItem;
        setLogs((previous) => {
          const next = [...previous, parsed];
          return next.slice(-300);
        });
      } catch {
        setStatus('error');
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [projectId, deploymentId, initialAfter, initialLogs]);

  return (
    <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
      <p className="mb-2 text-slate-500">
        Live stream status:{' '}
        <span className={status === 'live' ? 'text-emerald-300' : status === 'error' ? 'text-rose-300' : 'text-amber-300'}>
          {status}
        </span>
      </p>
      <div className="max-h-72 overflow-auto">
        {logs.length === 0 ? (
          <p className="text-slate-500">No logs received yet.</p>
        ) : (
          logs.map((log, index) => (
            <p key={`${log.timestamp}-${index}`} className="mb-1 whitespace-pre-wrap break-words text-slate-300">
              <span className="text-slate-500">[{log.timestamp}]</span>{' '}
              <span className="text-cyan-300">{log.level.toUpperCase()}</span> {log.message}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
