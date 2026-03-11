import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const severity: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = env.LOG_LEVEL;

function shouldLog(level: LogLevel): boolean {
  return severity[level] >= severity[configuredLevel];
}

function writeLog(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'worker',
    message,
    ...(metadata ?? {})
  };

  const line = JSON.stringify(record);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>) => {
    writeLog('debug', message, metadata);
  },
  info: (message: string, metadata?: Record<string, unknown>) => {
    writeLog('info', message, metadata);
  },
  warn: (message: string, metadata?: Record<string, unknown>) => {
    writeLog('warn', message, metadata);
  },
  error: (message: string, metadata?: Record<string, unknown>) => {
    writeLog('error', message, metadata);
  }
};
