import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const composeFile = readFileSync(resolve(currentDir, '../../../../docker-compose.yml'), 'utf8');

test('compose api service pins dev auth off for the production-like stack', () => {
  assert.match(composeFile, /api:\s*(?:.|\r?\n)*?ENABLE_DEV_AUTH:\s+false/);
  assert.doesNotMatch(composeFile, /ENABLE_DEV_AUTH:\s+\$\{ENABLE_DEV_AUTH:-false\}/);
});
