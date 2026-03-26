import type { Redis } from 'ioredis';

import { logger as defaultLogger } from '../logger/logger.js';
import type { DeploymentStateService } from './deployment-state.service.js';
import { BackgroundScheduler } from './background-scheduler.js';
import { createHeartbeatRedis } from './heartbeat-redis.factory.js';

type Logger = typeof defaultLogger;

type SchedulerConstructor = new (
  stateService: DeploymentStateService,
  heartbeatRedis: Redis,
  logger: Logger
) => BackgroundScheduler;

interface CreateConfiguredBackgroundSchedulerOptions {
  stateService: DeploymentStateService;
  logger?: Logger;
  createHeartbeatRedis?: () => Redis;
  SchedulerClass?: SchedulerConstructor;
}

export function createConfiguredBackgroundScheduler(
  options: CreateConfiguredBackgroundSchedulerOptions
) {
  const logger = options.logger ?? defaultLogger;
  const heartbeatRedis = (options.createHeartbeatRedis ?? createHeartbeatRedis)();
  const SchedulerClass =
    options.SchedulerClass ?? (BackgroundScheduler as unknown as SchedulerConstructor);

  return new SchedulerClass(options.stateService, heartbeatRedis, logger);
}
