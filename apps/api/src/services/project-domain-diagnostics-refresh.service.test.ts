import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { env } = await import('../config/env.js');
const {
  ProjectDomainDiagnosticsRefreshService
} = await import('./project-domain-diagnostics-refresh.service.js');

async function withEnvOverrides(
  overrides: Partial<typeof env>,
  run: () => Promise<void>
) {
  const originalValues = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, env[key as keyof typeof env]])
  );

  Object.assign(env, overrides);

  try {
    await run();
  } finally {
    Object.assign(env, originalValues);
  }
}

test('refreshStaleDomainDiagnostics refreshes stale projects with the configured cutoff and batch size', async (t) => {
  const staleInputs: Array<{ staleBefore: Date; limit: number }> = [];
  const refreshedProjectIds: string[] = [];

  await withEnvOverrides({
    PROJECT_DOMAIN_DIAGNOSTICS_STALE_MS: 60_000,
    PROJECT_DOMAIN_DIAGNOSTICS_BATCH_SIZE: 2
  }, async () => {
    t.mock.method(Date, 'now', () => Date.parse('2026-03-28T12:00:00.000Z'));

    const service = new ProjectDomainDiagnosticsRefreshService(
      {
        async listProjectIdsForDomainDiagnosticsRefresh(input) {
          staleInputs.push(input);
          return ['project-1', 'project-2'];
        },
        async refreshProjectDomainDiagnostics(projectId) {
          refreshedProjectIds.push(projectId);
        }
      },
      {
        warn() {}
      }
    );

    const result = await service.refreshStaleDomainDiagnostics();

    assert.deepEqual(staleInputs, [{
      staleBefore: new Date('2026-03-28T11:59:00.000Z'),
      limit: 2
    }]);
    assert.deepEqual(refreshedProjectIds, ['project-1', 'project-2']);
    assert.deepEqual(result, {
      refreshedProjects: 2
    });
  });
});

test('refreshStaleDomainDiagnostics continues after an individual project refresh fails', async () => {
  const warnings: Array<{ metadata: Record<string, unknown>; message: string }> = [];

  const service = new ProjectDomainDiagnosticsRefreshService(
    {
      async listProjectIdsForDomainDiagnosticsRefresh() {
        return ['project-1', 'project-2'];
      },
      async refreshProjectDomainDiagnostics(projectId) {
        if (projectId === 'project-1') {
          throw new Error('dns lookup failed');
        }
      }
    },
    {
      warn(metadata, message) {
        warnings.push({ metadata, message });
      }
    }
  );

  const result = await service.refreshStaleDomainDiagnostics();

  assert.deepEqual(result, {
    refreshedProjects: 1
  });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'project domain diagnostics refresh failed');
  assert.equal(warnings[0]?.metadata.projectId, 'project-1');
});

test('start is idempotent and skips overlapping refresh runs until the active pass settles', async (t) => {
  const intervalHandlers: Array<() => void> = [];
  const clearCalls: Array<ReturnType<typeof setInterval>> = [];
  let releaseRefresh: (() => void) | null = null;
  let refreshCalls = 0;
  let firstRefreshCompletedResolve: (() => void) | null = null;
  const firstRefreshCompleted = new Promise<void>((resolve) => {
    firstRefreshCompletedResolve = resolve;
  });

  await withEnvOverrides({
    PROJECT_DOMAIN_DIAGNOSTICS_REFRESH_INTERVAL_MS: 30_000
  }, async () => {
    const service = new ProjectDomainDiagnosticsRefreshService(
      {
        async listProjectIdsForDomainDiagnosticsRefresh() {
          refreshCalls += 1;
          if (refreshCalls === 1) {
            await new Promise<void>((resolve) => {
              releaseRefresh = resolve;
            });
            firstRefreshCompletedResolve?.();
          }
          return [];
        },
        async refreshProjectDomainDiagnostics() {}
      },
      {
        warn() {}
      },
      {
        setIntervalFn: ((handler: TimerHandler) => {
          if (typeof handler !== 'function') {
            throw new Error('expected function interval handler');
          }

          intervalHandlers.push(handler as () => void);
          return Symbol('interval') as unknown as ReturnType<typeof setInterval>;
        }) as unknown as typeof setInterval,
        clearIntervalFn: ((token: ReturnType<typeof setInterval>) => {
          clearCalls.push(token);
        }) as unknown as typeof clearInterval
      }
    );

    service.start();
    service.start();

    assert.equal(intervalHandlers.length, 1);
    assert.equal(refreshCalls, 1);

    const registeredIntervalHandler = intervalHandlers[0];
    if (!registeredIntervalHandler) {
      throw new Error('expected interval handler to be registered');
    }

    registeredIntervalHandler();
    assert.equal(refreshCalls, 1);

    releaseRefresh?.();
    await firstRefreshCompleted;
    await new Promise<void>((resolve) => setImmediate(resolve));

    registeredIntervalHandler();
    await Promise.resolve();
    assert.equal(refreshCalls, 2);

    service.stop();
    assert.equal(clearCalls.length, 1);
  });
});
