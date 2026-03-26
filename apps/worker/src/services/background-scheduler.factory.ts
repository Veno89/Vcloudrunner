import type { Redis as RedisClient } from 'ioredis';

import { logger as defaultLogger } from '../logger/logger.js';
import type { DeploymentStateService } from './deployment-state.service.js';
import { BackgroundScheduler } from './background-scheduler.js';
import { createConfiguredBackgroundScheduler } from './configured-background-scheduler.factory.js';
import { createHeartbeatRedis } from './heartbeat-redis.factory.js';

type Logger = typeof defaultLogger;

type SchedulerConstructor = new (
  stateService: DeploymentStateService,
  heartbeatRedis: RedisClient,
  logger: Logger
) => BackgroundScheduler;

interface CreateBackgroundSchedulerOptions {
  stateService: DeploymentStateService;
  logger?: Logger;
  createHeartbeatRedis?: () => RedisClient;
  SchedulerClass?: SchedulerConstructor;
}

export function createBackgroundScheduler(options: CreateBackgroundSchedulerOptions) {
  const {
    stateService,
    logger = defaultLogger,
    createHeartbeatRedis: createHeartbeatRedisFn,
    SchedulerClass
  } = options;

  if (!createHeartbeatRedisFn && !SchedulerClass) {
    return createConfiguredBackgroundScheduler({ stateService, logger });
  }

  const heartbeatRedis = (createHeartbeatRedisFn ?? createHeartbeatRedis)();
  const ResolvedSchedulerClass =
    SchedulerClass ?? (BackgroundScheduler as SchedulerConstructor);

  return new ResolvedSchedulerClass(stateService, heartbeatRedis, logger);
}
