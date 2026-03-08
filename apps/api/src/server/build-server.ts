import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';

import { env } from '../config/env.js';
import { deploymentsRoutes } from '../modules/deployments/deployments.routes.js';
import { environmentRoutes } from '../modules/environment/environment.routes.js';
import { logsRoutes } from '../modules/logs/logs.routes.js';
import { projectsRoutes } from '../modules/projects/projects.routes.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';

export const buildServer = () => {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  app.register(cors, { origin: true });
  app.register(sensible);
  app.register(errorHandlerPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(projectsRoutes, { prefix: '/v1' });
  app.register(deploymentsRoutes, { prefix: '/v1' });
  app.register(environmentRoutes, { prefix: '/v1' });
  app.register(logsRoutes, { prefix: '/v1' });

  return app;
};
