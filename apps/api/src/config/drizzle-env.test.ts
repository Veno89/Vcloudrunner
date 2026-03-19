import assert from 'node:assert/strict';
import test from 'node:test';

import { requireDrizzleDatabaseUrl } from './drizzle-env.js';

test('requireDrizzleDatabaseUrl returns the configured DATABASE_URL', () => {
  assert.equal(
    requireDrizzleDatabaseUrl({ DATABASE_URL: 'postgres://user:pass@localhost:5432/db' }),
    'postgres://user:pass@localhost:5432/db'
  );
});

test('requireDrizzleDatabaseUrl trims surrounding whitespace', () => {
  assert.equal(
    requireDrizzleDatabaseUrl({ DATABASE_URL: '  postgres://user:pass@localhost:5432/db  ' }),
    'postgres://user:pass@localhost:5432/db'
  );
});

test('requireDrizzleDatabaseUrl fails fast when DATABASE_URL is missing', () => {
  assert.throws(
    () => requireDrizzleDatabaseUrl({}),
    /DATABASE_URL is required for drizzle-kit commands/
  );
});
