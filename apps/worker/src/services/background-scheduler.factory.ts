import Redis, { type Redis as RedisClient } from 'ioredis';

import { env } from '../config/env.js';
import { logger as defaultLogger } from '../logger/logger.js';
import type { DeploymentStateService } from './deployment-state.service.js';
import { BackgroundScheduler } from './background-scheduler.js';

type Logger = typeof defaultLogger;

type RedisConstructor = new (
  url: string,
  options: {
    maxRetriesPerRequest: null;
    enableReadyCheck: false;
  }
) => RedisClient;

type SchedulerConstructor = new (
  stateService: DeploymentStateService,
  heartbeatRedis: RedisClient,
  logger: Logger
) => BackgroundScheduler;

interface CreateBackgroundSchedulerOptions {
  stateService: DeploymentStateService;
  logger?: Logger;
  RedisClass?: RedisConstructor;
  SchedulerClass?: SchedulerConstructor;
}

export function createBackgroundScheduler(options: CreateBackgroundSchedulerOptions) {
  const {
    stateService,
    logger = defaultLogger,
    RedisClass = Redis as unknown as RedisConstructor,
    SchedulerClass = BackgroundScheduler as SchedulerConstructor
  } = options;

  const heartbeatRedis = new RedisClass(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });

  return new SchedulerClass(stateService, heartbeatRedis, logger);
}
