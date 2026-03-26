import { createConfiguredRedisConnection } from './configured-redis-connection.factory.js';
import { parseRedisConnectionOptions } from './redis.js';

interface CreateRedisConnectionOptions {
  redisUrl?: string;
}

export function createRedisConnection(options: CreateRedisConnectionOptions = {}) {
  if (!options.redisUrl) {
    return createConfiguredRedisConnection();
  }

  return parseRedisConnectionOptions(options.redisUrl);
}
