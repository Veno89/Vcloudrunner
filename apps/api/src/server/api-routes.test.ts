import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { errorHandlerPlugin } from '../plugins/error-handler.js';
import {
  DomainError,
  ProjectNotFoundError,
  DeploymentNotFoundError,
  ProjectSlugTakenError,
  DeploymentCancellationNotAllowedError,
  DeploymentAlreadyActiveError,
  DeploymentQueueUnavailableError,
  ApiTokenNotFoundError
} from './domain-errors.js';

function buildTestApp() {
  const app = Fastify({ logger: false });
  app.register(errorHandlerPlugin);
  return app;
}

test('error handler maps ProjectNotFoundError to 404', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new ProjectNotFoundError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PROJECT_NOT_FOUND');
});

test('error handler maps DeploymentNotFoundError to 404', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentNotFoundError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'DEPLOYMENT_NOT_FOUND');
});

test('error handler maps ProjectSlugTakenError to 409', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new ProjectSlugTakenError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 409);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PROJECT_SLUG_TAKEN');
});

test('error handler maps DeploymentAlreadyActiveError to 409', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentAlreadyActiveError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 409);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'DEPLOYMENT_ALREADY_ACTIVE');
});


test('error handler maps DeploymentQueueUnavailableError to 503', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentQueueUnavailableError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'DEPLOYMENT_QUEUE_UNAVAILABLE');
});

test('error handler maps DeploymentCancellationNotAllowedError to 409', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentCancellationNotAllowedError('running');
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 409);
});

test('error handler maps ApiTokenNotFoundError to 404', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new ApiTokenNotFoundError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 404);
});

test('error handler maps unknown DomainError to its statusCode', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DomainError('CUSTOM_CODE', 'Custom failure', 422);
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 422);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'CUSTOM_CODE');
  assert.equal(body.message, 'Custom failure');
});

test('error handler returns 500 for non-domain errors', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new Error('unexpected kaboom');
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 500);
});

test('unknown route returns 404 JSON', async () => {
  const app = buildTestApp();

  const res = await app.inject({ method: 'GET', url: '/v1/does-not-exist' });
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'NOT_FOUND');
});
