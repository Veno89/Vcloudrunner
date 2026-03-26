import type { FastifyPluginAsync } from 'fastify';

import { requireActor } from './auth-utils.js';
import type { AuthService } from './auth.service.js';

export const createAuthRoutes = (
  authService: Pick<AuthService, 'getViewer'>
): FastifyPluginAsync => async (app) => {
  app.get('/auth/me', async (request) => {
    return {
      data: await authService.getViewer(requireActor(request))
    };
  });
};
