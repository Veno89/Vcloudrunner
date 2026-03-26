import Redis, { type Redis as RedisClient } from 'ioredis';

import { env } from '../config/env.js';

export type HeartbeatRedisConstructor = new (
  url: string,
  options: {
    maxRetriesPerRequest: null;
    enableReadyCheck: false;
  }
) => RedisClient;

interface CreateHeartbeatRedisOptions {
  RedisClass?: HeartbeatRedisConstructor;
}

export function createHeartbeatRedis(options: CreateHeartbeatRedisOptions = {}) {
  const RedisClass = options.RedisClass ?? (Redis as unknown as HeartbeatRedisConstructor);

  return new RedisClass(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}
