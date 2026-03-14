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
    <div className="mt-3 rounded-md border bg-card p-3 font-mono text-xs text-card-foreground">
      <p className="mb-2 text-muted-foreground">
        Live stream status:{' '}
        <span className={status === 'live' ? 'text-emerald-500' : status === 'error' ? 'text-destructive' : 'text-amber-500'}>
          {status}
        </span>
      </p>
      <div className="max-h-96 overflow-auto rounded-md border bg-background p-2">
        {logs.length === 0 ? (
          <p className="text-muted-foreground">No logs received yet.</p>
        ) : (
          logs.map((log, index) => (
            <p key={`${log.timestamp}-${index}`} className="mb-1 whitespace-pre-wrap break-words">
              <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
              <span className="text-primary">{log.level.toUpperCase()}</span> {log.message}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
