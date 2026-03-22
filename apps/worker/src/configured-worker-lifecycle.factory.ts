import { createWorkerLifecycle } from './bootstrap.js';
import { createDeploymentStateService } from './services/deployment-state.service.factory.js';
import { createBackgroundScheduler } from './services/background-scheduler.factory.js';
import { createRuntimeInspector } from './services/runtime/runtime-inspector.factory.js';

interface WorkerLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

interface WorkerStateService {
  reconcileRunningDeployments(checkContainerRunning: (containerId: string) => Promise<boolean>): Promise<number>;
}

interface WorkerScheduler {
  start(): void;
  stop(): Promise<unknown>;
  publishHeartbeat(): Promise<unknown>;
}

interface RuntimeInspector {
  isContainerRunning(containerId: string): Promise<boolean>;
}

interface CreateSchedulerOptions {
  stateService: WorkerStateService;
  logger: WorkerLogger;
}

interface WorkerJob {
  id?: string | number | null;
  data: {
    deploymentId: string;
    correlationId?: string | null;
  };
}

export interface WorkerLifecycle {
  handleReady(): void;
  handleCompleted(job: WorkerJob): void;
  handleFailed(job: WorkerJob | undefined, error: Error): void;
  shutdown(signal: NodeJS.Signals): Promise<void>;
}

interface CreateConfiguredWorkerLifecycleOptions {
  logger: WorkerLogger;
  closeWorker: () => Promise<unknown>;
  createStateService?: () => WorkerStateService;
  createRuntimeInspector?: () => RuntimeInspector;
  createScheduler?: (options: CreateSchedulerOptions) => WorkerScheduler;
}

export function createConfiguredWorkerLifecycle(
  options: CreateConfiguredWorkerLifecycleOptions
): WorkerLifecycle {
  const createStateServiceFn =
    options.createStateService ?? (createDeploymentStateService as unknown as () => WorkerStateService);
  const createRuntimeInspectorFn =
    options.createRuntimeInspector ?? (createRuntimeInspector as unknown as () => RuntimeInspector);
  const createSchedulerFn =
    options.createScheduler ??
    (createBackgroundScheduler as unknown as (options: CreateSchedulerOptions) => WorkerScheduler);

  const stateService = createStateServiceFn();
  const runtimeInspector = createRuntimeInspectorFn();
  const scheduler = createSchedulerFn({
    stateService,
    logger: options.logger
  });

  return createWorkerLifecycle({
    logger: options.logger,
    scheduler,
    stateService,
    isContainerRunning: (containerId) => runtimeInspector.isContainerRunning(containerId),
    closeWorker: options.closeWorker
  });
}
