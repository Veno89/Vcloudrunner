import type { ConnectionOptions } from 'bullmq';

import { env } from '../config/env.js';

function parseRedisDatabaseIndex(pathname: string): number {
  if (pathname.length <= 1) {
    return 0;
  }

  const databaseIndex = pathname.slice(1);
  if (!/^\d+$/.test(databaseIndex)) {
    throw new Error(
      'REDIS_URL path must be empty or a single integer database index such as redis://host:6379/0'
    );
  }

  return Number.parseInt(databaseIndex, 10);
}

export function parseRedisConnectionOptions(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: url.port.length > 0 ? Number.parseInt(url.port, 10) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: parseRedisDatabaseIndex(url.pathname),
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export const redisConnection: ConnectionOptions = parseRedisConnectionOptions(env.REDIS_URL);
