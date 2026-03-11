import test from 'node:test';
import assert from 'node:assert/strict';

import { isNonRetryableDeploymentError, remainingAttempts } from './deployment-worker.utils.js';

test('isNonRetryableDeploymentError matches known permanent failures case-insensitively', () => {
  assert.equal(isNonRetryableDeploymentError('Repository NOT FOUND for origin'), true);
  assert.equal(isNonRetryableDeploymentError('remote: permission denied to repo'), true);
  assert.equal(isNonRetryableDeploymentError('dockerfile parse error line 1'), true);
});

test('isNonRetryableDeploymentError returns false for transient failures', () => {
  assert.equal(isNonRetryableDeploymentError('network timeout pulling image'), false);
  assert.equal(isNonRetryableDeploymentError('temporary unavailable from remote host'), false);
});

test('remainingAttempts computes attempts left with floor at zero', () => {
  assert.equal(remainingAttempts({ attemptsMade: 0, opts: { attempts: 3 } }), 2);
  assert.equal(remainingAttempts({ attemptsMade: 2, opts: { attempts: 3 } }), 0);
  assert.equal(remainingAttempts({ attemptsMade: 5, opts: { attempts: 3 } }), 0);
  assert.equal(remainingAttempts({ attemptsMade: 0, opts: {} }), 0);
});
