interface WorkerLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

interface WorkerScheduler {
  start(): void;
  stop(): Promise<unknown>;
  publishHeartbeat(): Promise<unknown>;
}

interface WorkerStateService {
  reconcileRunningDeployments(checkContainerRunning: (containerId: string) => Promise<boolean>): Promise<number>;
}

interface WorkerJob {
  id?: string | number | null;
  data: {
    deploymentId: string;
    correlationId?: string | null;
  };
}

type ExitFn = (code: number) => void | never;

interface WorkerLifecycleDependencies {
  logger: WorkerLogger;
  scheduler: WorkerScheduler;
  stateService: WorkerStateService;
  isContainerRunning: (containerId: string) => Promise<boolean>;
  closeWorker: () => Promise<unknown>;
  exit?: ExitFn;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createWorkerLifecycle(dependencies: WorkerLifecycleDependencies) {
  const {
    logger,
    scheduler,
    stateService,
    isContainerRunning,
    closeWorker
  } = dependencies;
  const exit = dependencies.exit ?? process.exit;

  let readyHandled = false;
  let shutdownPromise: Promise<void> | undefined;

  const handleReady = (): void => {
    if (readyHandled) {
      return;
    }

    readyHandled = true;
    logger.info('deployment worker ready');

    void scheduler.publishHeartbeat().catch((error) => {
      logger.warn('worker heartbeat publish failed', {
        message: errorMessage(error)
      });
    });

    void stateService.reconcileRunningDeployments(isContainerRunning)
      .then((reconciledCount) => {
        if (reconciledCount > 0) {
          logger.warn('startup state reconciliation completed', { reconciledCount });
          return;
        }

        logger.info('startup state reconciliation: all running deployments verified');
      })
      .catch((error) => {
        logger.error('startup state reconciliation failed', {
          message: errorMessage(error)
        });
      });

    scheduler.start();
  };

  const handleCompleted = (job: WorkerJob): void => {
    logger.info('job completed', {
      jobId: job.id,
      deploymentId: job.data.deploymentId,
      correlationId: job.data.correlationId ?? `queue-job:${job.id ?? 'unknown'}`
    });
  };

  const handleFailed = (job: WorkerJob | undefined, error: Error): void => {
    logger.error('job failed', {
      jobId: job?.id,
      deploymentId: job?.data.deploymentId,
      correlationId: job?.data.correlationId ?? `queue-job:${job?.id ?? 'unknown'}`,
      message: error.message
    });
  };

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      logger.info(`received ${signal}, shutting down worker`);

      let succeeded = true;

      try {
        await scheduler.stop();
      } catch (error) {
        succeeded = false;
        logger.error('worker scheduler stop failed', {
          signal,
          message: errorMessage(error)
        });
      }

      try {
        await closeWorker();
      } catch (error) {
        succeeded = false;
        logger.error('worker close failed', {
          signal,
          message: errorMessage(error)
        });
      }

      if (succeeded) {
        logger.info('worker shut down cleanly');
        exit(0);
        return;
      }

      exit(1);
    })();

    return shutdownPromise;
  };

  return {
    handleReady,
    handleCompleted,
    handleFailed,
    shutdown
  };
}
