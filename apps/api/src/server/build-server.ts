import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';

import { env } from '../config/env.js';
import { deploymentsRoutes } from '../modules/deployments/deployments.routes.js';
import { apiTokensRoutes } from '../modules/api-tokens/api-tokens.routes.js';
import { authContextPlugin } from '../plugins/auth-context.js';
import { environmentRoutes } from '../modules/environment/environment.routes.js';
import { logsRoutes } from '../modules/logs/logs.routes.js';
import { projectsRoutes } from '../modules/projects/projects.routes.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';

export const buildServer = () => {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: { service: 'api' },
      messageKey: 'message',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`
    }
  });

  app.register(cors, { origin: true });
  app.register(sensible);
  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(projectsRoutes, { prefix: '/v1' });
  app.register(apiTokensRoutes, { prefix: '/v1' });
  app.register(deploymentsRoutes, { prefix: '/v1' });
  app.register(environmentRoutes, { prefix: '/v1' });
  app.register(logsRoutes, { prefix: '/v1' });

  return app;
};
