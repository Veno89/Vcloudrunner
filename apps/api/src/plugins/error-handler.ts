import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { DomainError } from '../server/domain-errors.js';

const errorHandlerPluginImpl: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId: request.id,
        details: error.flatten()
      });
    }

    if (error instanceof DomainError) {
      const level = error.statusCode >= 500 ? 'error' : 'warn';
      app.log[level]({
        code: error.code,
        statusCode: error.statusCode,
        requestId: request.id,
        method: request.method,
        url: request.url
      }, error.message);

      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        requestId: request.id
      });
    }

    app.log.error({
      err: error,
      requestId: request.id,
      method: request.method,
      url: request.url
    });

    return reply.status(500).send({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId: request.id
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      code: 'NOT_FOUND',
      message: 'Route not found',
      requestId: request.id
    });
  });
};

export const errorHandlerPlugin = fp(errorHandlerPluginImpl, {
  name: 'error-handler'
});
