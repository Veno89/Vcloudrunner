import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireActor, requireScope } from '../auth/auth-utils.js';
import type { GitHubAppService } from './github-app.service.js';

export function createGitHubRoutes(githubService: GitHubAppService): FastifyPluginAsync {
  return async (app) => {
    // Store raw body for webhook signature verification
    app.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (req, body, done) => {
        (req as unknown as { rawBody: string }).rawBody = body as string;
        try {
          done(null, JSON.parse(body as string));
        } catch (err) {
          done(err as Error, undefined);
        }
      }
    );

    app.get('/github/status', async () => {
      return { data: { configured: githubService.isConfigured } };
    });

    app.post('/github/webhook', async (request, reply) => {
      const signature = request.headers['x-hub-signature-256'] as string | undefined;
      const event = request.headers['x-github-event'] as string | undefined;

      if (!signature || !event) {
        return reply.code(400).send({ error: 'Missing signature or event header' });
      }

      const rawBody = (request as unknown as { rawBody?: string }).rawBody
        ?? JSON.stringify(request.body);

      if (!githubService.verifyWebhookSignature(rawBody, signature)) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      await githubService.handleWebhookEvent(event, request.body as Record<string, unknown>);
      return reply.code(200).send({ ok: true });
    });

    app.get('/github/install-url', async (request) => {
      const actor = requireActor(request);
      requireScope(actor, 'projects:write');

      const state = actor.userId;
      return { data: { url: githubService.getInstallUrl(state) } };
    });

    app.post('/github/installations/callback', async (request, reply) => {
      const actor = requireActor(request);
      requireScope(actor, 'projects:write');

      const body = z.object({
        installationId: z.number().int().positive()
      }).parse(request.body);

      const record = await githubService.handleInstallationCallback(
        actor.userId,
        body.installationId
      );

      return reply.code(201).send({ data: record });
    });

    app.get('/github/installations', async (request) => {
      const actor = requireActor(request);
      requireScope(actor, 'projects:read');

      const installations = await githubService.listUserInstallations(actor.userId);
      return { data: installations };
    });

    app.get('/github/installations/:installationId/repos', async (request) => {
      const actor = requireActor(request);
      requireScope(actor, 'projects:read');

      const params = z.object({
        installationId: z.coerce.number().int().positive()
      }).parse(request.params);

      const repos = await githubService.listInstallationRepos(params.installationId);
      return { data: repos };
    });

    app.delete('/github/installations/:installationId', async (request, reply) => {
      const actor = requireActor(request);
      requireScope(actor, 'projects:write');

      const params = z.object({
        installationId: z.coerce.number().int().positive()
      }).parse(request.params);

      await githubService.removeInstallation(actor.userId, params.installationId);
      return reply.code(204).send();
    });
  };
}
