import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyDeploymentFailure } from './deployment-errors.js';
import { remainingAttempts } from './deployment-worker.utils.js';

test('classifyDeploymentFailure maps known permanent failures to non-retryable codes', () => {
  assert.equal(classifyDeploymentFailure(new Error('Repository NOT FOUND for origin')).retryable, false);
  assert.equal(classifyDeploymentFailure(new Error('remote: permission denied to repo')).code, 'DEPLOYMENT_REPOSITORY_AUTH_FAILED');
  assert.equal(classifyDeploymentFailure(new Error('DEPLOYMENT_DOCKERFILE_NOT_FOUND: no Dockerfile')).code, 'DEPLOYMENT_DOCKERFILE_NOT_FOUND');
});

test('classifyDeploymentFailure returns retryable classification for transient failures', () => {
  assert.equal(classifyDeploymentFailure(new Error('network timeout pulling image')).retryable, true);
  assert.equal(classifyDeploymentFailure(new Error('temporary unavailable from remote host')).retryable, true);
});

test('remainingAttempts computes attempts left with floor at zero', () => {
  assert.equal(remainingAttempts({ attemptsMade: 0, opts: { attempts: 3 } }), 2);
  assert.equal(remainingAttempts({ attemptsMade: 2, opts: { attempts: 3 } }), 0);
  assert.equal(remainingAttempts({ attemptsMade: 5, opts: { attempts: 3 } }), 0);
  assert.equal(remainingAttempts({ attemptsMade: 0, opts: {} }), 0);
});
