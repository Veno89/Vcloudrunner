# Testing Conventions

Reference for subagents writing or modifying tests in the Vcloudrunner codebase.

---

## Framework Matrix

| Workspace | Framework | Assertion | Runner Command |
|-----------|-----------|-----------|----------------|
| `apps/api` | `node:test` (built-in) | `node:assert/strict` | `npx tsx --test "src/**/*.test.ts"` |
| `apps/worker` | `node:test` (built-in) | `node:assert/strict` | `npx tsx --test "src/**/*.test.ts"` |
| `apps/dashboard` | `vitest` | `expect` (vitest) | `npx vitest` |

---

## File Naming and Location

- Test files are **co-located** with their source files, not in a separate `__tests__/` directory.
- Naming: `<source-file>.test.ts` — e.g. `deployments.service.ts` → `deployments.service.test.ts`
- Factory test variant: `<source-file>.factory.test.ts` for factory function tests
- Route tests: `<module>.routes.test.ts` or `api-routes.test.ts`

```
modules/deployments/
  deployments.service.ts
  deployments.service.test.ts
  deployments.repository.ts
  deployments.routes.ts
```

---

## API and Worker Tests (`node:test`)

### Basic Structure

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

test('description of what is being tested', async () => {
  // Arrange
  const service = new SomeService(mockDb, mockQueue);

  // Act
  const result = await service.doSomething(input);

  // Assert
  assert.strictEqual(result.status, 'running');
  assert.deepStrictEqual(result.tags, ['web', 'public']);
});
```

### Grouped Tests

```typescript
test('DeploymentsService', async (t) => {
  await t.test('createDeployment creates a queued deployment', async () => {
    // ...
  });

  await t.test('createDeployment rejects when active deployment exists', async () => {
    // ...
  });
});
```

### Mocking via DI

Tests inject mocks through the constructor dependencies bag — **no monkey-patching**, no `jest.mock()`:

```typescript
const mockRepository = {
  findById: async () => ({ id: 'test-id', status: 'running' }),
  updateStatus: async () => {},
};

const service = new DeploymentsService(mockDb, mockQueue, {
  deploymentsRepository: mockRepository as unknown as DeploymentsRepository,
});
```

### Asserting Errors

```typescript
await assert.rejects(
  () => service.createDeployment(invalidInput),
  (error: DomainError) => {
    assert.strictEqual(error.code, 'PROJECT_NOT_FOUND');
    assert.strictEqual(error.statusCode, 404);
    return true;
  }
);
```

### Asserting API Routes

Route tests use a helper to build a real Fastify instance with controlled dependencies:

```typescript
function buildTestApp(options?: { apiTokensJson?: string }) {
  const originalApiTokensJson = env.API_TOKENS_JSON;
  // ... configure env, build Fastify app, register routes
  return { app, cleanup };
}

test('POST /projects/:id/deployments returns 201', async () => {
  const { app, cleanup } = buildTestApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/test-id/deployments',
      headers: { authorization: 'Bearer test-token' },
      payload: { branch: 'main' },
    });
    assert.strictEqual(response.statusCode, 201);
  } finally {
    await cleanup();
  }
});
```

### Env Fixture Isolation

Tests must not inherit values from `.env` files. Use deterministic fixtures:

```typescript
const originalValue = env.SOME_FLAG;
// Override for test
env.SOME_FLAG = true;
try {
  // ... test logic
} finally {
  env.SOME_FLAG = originalValue; // always restore
}
```

---

## Dashboard Tests (Vitest)

### Basic Structure

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('helper function', () => {
  it('formats deployment status correctly', () => {
    expect(formatStatus('running')).toBe('Running');
  });

  it('returns unknown for invalid status', () => {
    expect(formatStatus('invalid')).toBe('Unknown');
  });
});
```

### Mocking

```typescript
import { vi } from 'vitest';

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: [] }),
});
```

### Running

```bash
# Run all dashboard tests
cd apps/dashboard && npx vitest

# Run specific test file
cd apps/dashboard && npx vitest helpers.test.ts

# Watch mode
cd apps/dashboard && npx vitest --watch
```

---

## What NOT to Do

1. **Do NOT use `jest`** — API and Worker use `node:test`, Dashboard uses `vitest`
2. **Do NOT create `__tests__/` directories** — tests are co-located
3. **Do NOT monkey-patch modules** — use constructor DI for mocks
4. **Do NOT import from `jest`** — it is not installed anywhere
5. **Do NOT skip `try/finally` cleanup** — always restore env overrides
6. **Do NOT add tests to CI** — the CI workflow currently runs lint + typecheck + build only
