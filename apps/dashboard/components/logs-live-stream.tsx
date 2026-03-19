'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logLevelTextClassName } from '@/lib/helpers';

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

const MAX_LOG_WINDOW = 300;

const logSignature = (log: LogItem) => `${log.timestamp}|${log.level}|${log.message}`;

const compareTimestamps = (left: string, right: string) => {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs !== rightMs) {
    return leftMs - rightMs;
  }

  return left.localeCompare(right);
};

const sortLogsByTimestamp = (left: LogItem, right: LogItem) => {
  const timestampComparison = compareTimestamps(left.timestamp, right.timestamp);
  if (timestampComparison !== 0) {
    return timestampComparison;
  }

  return logSignature(left).localeCompare(logSignature(right));
};

const normalizeLogWindow = (logs: LogItem[]) => {
  const uniqueLogs = new Map<string, LogItem>();

  for (const log of logs) {
    const signature = logSignature(log);
    if (!uniqueLogs.has(signature)) {
      uniqueLogs.set(signature, log);
    }
  }

  return [...uniqueLogs.values()].sort(sortLogsByTimestamp).slice(-MAX_LOG_WINDOW);
};

const latestTimestamp = (logs: LogItem[]) => logs[logs.length - 1]?.timestamp ?? '';

const toSignatureSet = (logs: LogItem[]) => new Set(logs.map(logSignature));

const isLogItem = (value: unknown): value is LogItem => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<LogItem>;
  return typeof candidate.level === 'string' && typeof candidate.message === 'string' && typeof candidate.timestamp === 'string';
};


const parseLogItem = (raw: string): LogItem | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isLogItem(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const areLogsEqual = (left: LogItem[], right: LogItem[]) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((log, index) => logSignature(log) === logSignature(right[index]));
};

export function LogsLiveStream({ projectId, deploymentId, initialLogs }: LogsLiveStreamProps) {
  const [logs, setLogs] = useState<LogItem[]>(() => normalizeLogWindow(initialLogs));
  const [status, setStatus] = useState<'connecting' | 'live' | 'paused' | 'error'>('connecting');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  const listRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const contextKey = `${projectId}:${deploymentId}`;
  const contextKeyRef = useRef(contextKey);
  const seenSignaturesRef = useRef(toSignatureSet(logs));
  const streamAfterRef = useRef('');

  const normalizedInitialLogs = useMemo(() => normalizeLogWindow(initialLogs), [initialLogs]);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return logs.filter((log) => {
      const levelMatch = levelFilter === 'all' || log.level.toLowerCase() === levelFilter;
      const queryMatch =
        normalizedQuery.length === 0 ||
        log.message.toLowerCase().includes(normalizedQuery) ||
        log.timestamp.toLowerCase().includes(normalizedQuery) ||
        log.level.toLowerCase().includes(normalizedQuery);
      return levelMatch && queryMatch;
    });
  }, [logs, levelFilter, query]);

  const applyLogWindow = (previous: LogItem[], next: LogItem[]) => {
    const nextSignatures = toSignatureSet(next);
    seenSignaturesRef.current = nextSignatures;

    if (areLogsEqual(previous, next)) {
      return previous;
    }

    return next;
  };

  useEffect(() => {
    if (contextKeyRef.current !== contextKey) {
      contextKeyRef.current = contextKey;
      const next = normalizedInitialLogs;
      setLogs(next);
      seenSignaturesRef.current = toSignatureSet(next);
      return;
    }

    setLogs((previous) => applyLogWindow(previous, normalizeLogWindow([...previous, ...normalizedInitialLogs])));
  }, [contextKey, normalizedInitialLogs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState !== 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setStatus('connecting');
    setLevelFilter('all');
    setQuery('');
    setExpanded(false);
    autoFollowRef.current = true;
  }, [projectId, deploymentId]);

  useEffect(() => {
    const latestSeenTimestamp = latestTimestamp(logs);

    if (!latestSeenTimestamp) {
      streamAfterRef.current = '';
      return;
    }

    const parsedTimestamp = Date.parse(latestSeenTimestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      streamAfterRef.current = latestSeenTimestamp;
      return;
    }

    streamAfterRef.current = new Date(Math.max(0, parsedTimestamp - 1)).toISOString();
  }, [logs]);

  useEffect(() => {
    if (!isDocumentVisible) {
      setStatus('paused');
      return;
    }

    const streamUrl = new URL('/api/log-stream', window.location.origin);
    streamUrl.searchParams.set('projectId', projectId);
    streamUrl.searchParams.set('deploymentId', deploymentId);

    if (streamAfterRef.current) {
      streamUrl.searchParams.set('after', streamAfterRef.current);
    }

    setStatus('connecting');
    const eventSource = new EventSource(streamUrl.toString());

    eventSource.onopen = () => {
      setStatus('live');
    };

    eventSource.onmessage = (event) => {
      const parsed = parseLogItem(event.data);
      if (!parsed) {
        return;
      }

      const parsedSignature = logSignature(parsed);

      if (seenSignaturesRef.current.has(parsedSignature)) {
        return;
      }

      setLogs((previous) => applyLogWindow(previous, normalizeLogWindow([...previous, parsed])));
    };

    eventSource.onerror = () => {
      setStatus('error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [deploymentId, isDocumentVisible, projectId, streamVersion]);

  useEffect(() => {
    if (!autoFollowRef.current) {
      return;
    }

    const list = listRef.current;
    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [logs]);

  const scrollToBottom = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    autoFollowRef.current = true;
    list.scrollTop = list.scrollHeight;
  };

  const handleListScroll = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const distanceFromBottom = list.scrollHeight - (list.scrollTop + list.clientHeight);
    autoFollowRef.current = distanceFromBottom < 24;
  };

  const reconnectStream = () => {
    if (!isDocumentVisible) {
      return;
    }

    setStatus('connecting');
    setStreamVersion((current) => current + 1);
  };


  const streamStatusVariant =
    status === 'live' ? 'success' : status === 'error' ? 'destructive' : 'warning';
  const streamStatusLabel = status === 'paused' ? 'paused' : status;

  return (
    <div className="mt-3 rounded-md border bg-card p-3 font-mono text-xs text-card-foreground">
      <div className="mb-2 space-y-2 text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            <span>Live stream status:</span>
            <Badge variant={streamStatusVariant} className="font-sans text-[10px]">
              {streamStatusLabel}
            </Badge>
          </div>
          <span aria-hidden>•</span>
          <p>
            Showing {filteredLogs.length} / {logs.length}
          </p>
          <span aria-hidden>•</span>
          <label htmlFor="logs-level-filter" className="sr-only">Filter logs by level</label>
          <Select
            id="logs-level-filter"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value as typeof levelFilter)}
            className="h-7 w-36 text-[11px]"
          >
            <option value="all">all levels</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
            <option value="debug">debug</option>
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={scrollToBottom} className="h-7 px-2 text-[11px]">
            Scroll to bottom
          </Button>
          {status === 'error' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={reconnectStream}
              className="h-7 px-2 text-[11px]"
            >
              Reconnect stream
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setExpanded((current) => !current)}
            className="h-7 px-2 text-[11px]"
            aria-pressed={expanded}
          >
            {expanded ? 'Collapse panel' : 'Expand panel'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="logs-search" className="sr-only">Search logs</label>
          <Input
            id="logs-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search message, level, or timestamp"
            className="h-8 text-xs"
          />
        </div>
        {status === 'paused' ? (
          <p className="text-[11px]">
            Live log streaming pauses while this tab is hidden and resumes automatically when you return.
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="text-[11px] text-destructive">
            Live log streaming disconnected. Try reconnecting here, and if it persists check{' '}
            <code>API_AUTH_TOKEN</code> or upstream API availability.
          </p>
        ) : null}
      </div>
      <div
        ref={listRef}
        onScroll={handleListScroll}
        aria-live="off"
        className={`overflow-auto rounded-md border bg-background p-2 ${expanded ? 'max-h-[36rem]' : 'max-h-96'}`}
      >
        {filteredLogs.length === 0 ? (
          <p className="text-muted-foreground">
            {logs.length === 0
              ? 'No logs received yet.'
              : query.trim().length > 0
                ? 'No logs match your search.'
                : `No ${levelFilter} logs in current window.`}
          </p>
        ) : (
          filteredLogs.map((log) => (
            <p key={logSignature(log)} className="mb-1 whitespace-pre-wrap break-words">
              <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
              <span className={logLevelTextClassName(log.level)}>{log.level.toUpperCase()}</span> {log.message}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
