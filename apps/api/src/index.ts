import { env } from './config/env.js';
import { buildServer } from './server/build-server.js';

const start = async () => {
  const app = buildServer();

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
