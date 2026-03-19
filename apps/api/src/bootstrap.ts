import { env } from './config/env.js';
import { buildServer } from './server/build-server.js';
import { initTelemetry, shutdownTelemetry } from './telemetry/otel.js';

interface BootstrapLogger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

interface BootstrapApp {
  listen(options: { host: string; port: number }): Promise<unknown>;
  close(): Promise<unknown>;
  log: BootstrapLogger;
}

interface BootstrapEnv {
  HOST: string;
  PORT: number;
}

type ExitFn = (code: number) => void | never;

interface BootstrapDependencies {
  env?: BootstrapEnv;
  buildServer?: () => BootstrapApp;
  initTelemetry?: () => Promise<void>;
  shutdownTelemetry?: () => Promise<void>;
  exit?: ExitFn;
  logger?: BootstrapLogger;
}

const fallbackLogger: BootstrapLogger = {
  info: () => undefined,
  error: (...args) => console.error(...args)
};

export function createApiLifecycle(dependencies: BootstrapDependencies = {}) {
  const config = dependencies.env ?? env;
  const buildApp = dependencies.buildServer ?? buildServer;
  const startTelemetry = dependencies.initTelemetry ?? initTelemetry;
  const stopTelemetry = dependencies.shutdownTelemetry ?? shutdownTelemetry;
  const exit = dependencies.exit ?? process.exit;
  const orphanLogger = dependencies.logger ?? fallbackLogger;

  let app: BootstrapApp | undefined;
  let startPromise: Promise<void> | undefined;
  let shutdownPromise: Promise<void> | undefined;

  const cleanup = async (context: 'startup' | 'shutdown'): Promise<boolean> => {
    const logger = app?.log ?? orphanLogger;
    const currentApp = app;
    app = undefined;

    let succeeded = true;

    if (currentApp) {
      try {
        await currentApp.close();
      } catch (error) {
        succeeded = false;
        logger.error({ error }, `error during ${context} server cleanup`);
      }
    }

    try {
      await stopTelemetry();
    } catch (error) {
      succeeded = false;
      logger.error({ error }, `error during ${context} telemetry shutdown`);
    }

    return succeeded;
  };

  const shutdown = async (signal: string): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      const logger = app?.log ?? orphanLogger;
      logger.info({ signal }, 'received shutdown signal, draining connections');

      const cleanedUp = await cleanup('shutdown');
      if (cleanedUp) {
        logger.info('server closed gracefully');
        exit(0);
        return;
      }

      exit(1);
    })();

    return shutdownPromise;
  };

  const start = async (): Promise<void> => {
    if (startPromise) {
      return startPromise;
    }

    startPromise = (async () => {
      await startTelemetry();

      try {
        app = buildApp();
        await app.listen({
          host: config.HOST,
          port: config.PORT
        });
      } catch (error) {
        const logger = app?.log ?? orphanLogger;
        logger.error({ error }, 'server failed to start');
        await cleanup('startup');
        exit(1);
      }
    })();

    return startPromise;
  };

  return {
    start,
    shutdown
  };
}
