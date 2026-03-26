import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultProjectServices,
  type ProjectServiceDefinition
} from '@vcloudrunner/shared-types';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { ProjectsRepository } = await import('./projects.repository.js');
const { ProjectsService } = await import('./projects.service.js');

const baseInput = {
  userId: '00000000-0000-0000-0000-000000000010',
  name: 'Example Project',
  slug: 'example-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main'
};

test('createProject defaults to one public app service when services are omitted', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  t.mock.method(ProjectsRepository.prototype, 'create', async (input: Record<string, unknown>) => {
    capturedInput = input as Record<string, unknown>;
    return {
      id: 'project-1',
      ...input
    } as any;
  });

  const service = new ProjectsService({} as never);
  const created = await service.createProject(baseInput);

  assert.deepEqual(capturedInput?.['services'], createDefaultProjectServices());
  assert.deepEqual((created as { services: unknown }).services, createDefaultProjectServices());
});

test('createProject preserves an explicit multi-service composition', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;
  const services: ProjectServiceDefinition[] = [
    {
      name: 'frontend',
      kind: 'web',
      sourceRoot: 'apps/frontend',
      exposure: 'public',
      runtime: {
        containerPort: 3000
      }
    },
    {
      name: 'worker',
      kind: 'worker',
      sourceRoot: 'apps/worker',
      exposure: 'internal'
    }
  ];

  t.mock.method(ProjectsRepository.prototype, 'create', async (input: Record<string, unknown>) => {
    capturedInput = input as Record<string, unknown>;
    return {
      id: 'project-2',
      ...input
    } as any;
  });

  const service = new ProjectsService({} as never);
  const created = await service.createProject({
    ...baseInput,
    services
  });

  assert.deepEqual(capturedInput?.['services'], services);
  assert.deepEqual((created as { services: unknown }).services, services);
});
