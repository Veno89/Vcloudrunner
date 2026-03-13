import { initTelemetry, shutdownTelemetry } from './telemetry/otel.js';
import { env } from './config/env.js';
import { buildServer } from './server/build-server.js';

const start = async () => {
  await initTelemetry();
  const app = buildServer();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'received shutdown signal, draining connections');
    try {
      await app.close();
      await shutdownTelemetry();
      app.log.info('server closed gracefully');
      process.exit(0);
    } catch (error) {
      app.log.error({ error }, 'error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
