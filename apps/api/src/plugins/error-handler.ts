import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { DomainError } from '../server/domain-errors.js';

type OperationalStatusError = Error & {
  statusCode?: number;
};

function getOperationalStatusCode(error: unknown) {
  const statusCode = (error as OperationalStatusError | undefined)?.statusCode;
  if (!Number.isInteger(statusCode) || statusCode === undefined) {
    return undefined;
  }

  if (statusCode < 400 || statusCode > 599) {
    return undefined;
  }

  return statusCode;
}

function getOperationalErrorCode(statusCode: number) {
  if (statusCode === 429) {
    return 'RATE_LIMIT_EXCEEDED';
  }

  return statusCode >= 500 ? 'REQUEST_FAILED' : 'REQUEST_ERROR';
}

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

    const operationalStatusCode = getOperationalStatusCode(error);
    if (operationalStatusCode !== undefined) {
      const level = operationalStatusCode >= 500 ? 'error' : 'warn';
      app.log[level]({
        err: error,
        statusCode: operationalStatusCode,
        requestId: request.id,
        method: request.method,
        url: request.url
      });

      return reply.status(operationalStatusCode).send({
        code: getOperationalErrorCode(operationalStatusCode),
        message: operationalStatusCode >= 500
          ? 'Request failed'
          : (error instanceof Error ? error.message : 'Request failed'),
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
