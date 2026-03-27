import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireActor } from './auth-utils.js';
import type { AuthService } from './auth.service.js';

const upsertViewerProfileSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.string().trim().max(320).email()
});

export const createAuthRoutes = (
  authService: Pick<AuthService, 'getViewer' | 'upsertViewerProfile'>
): FastifyPluginAsync => async (app) => {
  app.get('/auth/me', async (request) => {
    return {
      data: await authService.getViewer(requireActor(request))
    };
  });

  app.put('/auth/me/profile', async (request) => {
    return {
      data: await authService.upsertViewerProfile(
        requireActor(request),
        upsertViewerProfileSchema.parse(request.body)
      )
    };
  });
};
