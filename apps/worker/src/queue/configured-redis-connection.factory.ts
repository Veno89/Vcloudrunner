import { env } from '../config/env.js';
import { parseRedisConnectionOptions } from './redis.js';

export function createConfiguredRedisConnection() {
  return parseRedisConnectionOptions(env.REDIS_URL);
}
