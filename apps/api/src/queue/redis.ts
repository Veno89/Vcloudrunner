import type { ConnectionOptions } from 'bullmq';

import { env } from '../config/env.js';

function parseRedisConnectionOptions(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export const redisConnection: ConnectionOptions = parseRedisConnectionOptions(env.REDIS_URL);
