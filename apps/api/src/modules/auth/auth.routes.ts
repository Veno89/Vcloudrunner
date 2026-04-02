import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireActor } from './auth-utils.js';
import type { AuthService } from './auth.service.js';

const upsertViewerProfileSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.string().trim().max(320).email()
});

const registerSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.string().trim().max(320).email(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().max(320).email(),
  password: z.string().min(1).max(128)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
});

export const createAuthRoutes = (
  authService: Pick<AuthService, 'getViewer' | 'upsertViewerProfile' | 'register' | 'login' | 'changePassword'>
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

  app.post('/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input);
    return reply.code(201).send({ data: result });
  });

  app.post('/auth/login', async (request) => {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input);
    return { data: result };
  });

  app.post('/auth/me/change-password', async (request) => {
    const input = changePasswordSchema.parse(request.body);
    await authService.changePassword(requireActor(request), input);
    return { data: { success: true } };
  });
};
