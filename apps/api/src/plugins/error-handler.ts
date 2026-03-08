import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'ValidationError',
        details: error.flatten()
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: 'InternalServerError',
      message: 'An unexpected error occurred'
    });
  });
};
