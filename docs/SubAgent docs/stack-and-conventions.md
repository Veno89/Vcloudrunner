# Stack and Conventions

Quick-reference for subagents working in the Vcloudrunner codebase. Read this before writing any code.

---

## Monorepo Layout

```
apps/
  api/          → @vcloudrunner/api       (Fastify REST API)
  dashboard/    → @vcloudrunner/dashboard (Next.js 14 App Router)
  worker/       → @vcloudrunner/worker    (BullMQ job processor)
packages/
  shared-types/ → @vcloudrunner/shared-types (pure TS types + utils)
```

- **Package manager:** npm with native workspaces
- **Node version:** 20 (Docker images use `node:20-alpine`)
- **TypeScript:** 5.6+ across all packages
- **Module system:** ESM everywhere (`"type": "module"` in all `package.json` files)

---

## Language and Module Rules

| Rule | Detail |
|------|--------|
| **All imports use `.js` extensions** | `import { env } from './config/env.js';` — required for Node ESM resolution (API, Worker) |
| **Dashboard uses `@/*` alias** | `import { cn } from '@/lib/utils';` — resolved by Next.js bundler |
| **No barrel re-exports** | Import directly from the source module, not through `index.ts` aggregators (except `lib/api/index.ts` which is the legacy barrel) |
| **File naming** | `kebab-case.ts` for all files |
| **Class naming** | PascalCase: `DeploymentsService`, `ProjectsRepository` |
| **Function naming** | camelCase; factory functions use `create*` prefix: `createDeploymentsRoutes()`, `createDbClient()` |
| **Enum/type naming** | PascalCase for types, snake_case for Drizzle pgEnum names |

---

## API (`apps/api`)

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `fastify` | 4.28 | HTTP framework |
| `drizzle-orm` | 0.33 | ORM (PostgreSQL) |
| `drizzle-kit` | 0.24 | Migration tooling |
| `zod` | 3.23 | Schema validation |
| `bullmq` | 5.16 | Job queue |
| `ioredis` | 5.4 | Redis client |
| `bcrypt` | 6 | Password hashing |
| `pg` | 8.x | PostgreSQL driver |

### Architecture Layers

```
src/
  index.ts                → entry point, signal handlers
  bootstrap.ts            → createApiLifecycle() factory (DI root)
  config/
    env.ts                → Zod-parsed env singleton
    env-core.ts           → EnvSchema definition + envBoolean()/envInteger()
  db/
    client.ts             → createDbClient() → drizzle(pool, {schema})
    schema.ts             → all pgTable/pgEnum definitions
  server/
    build-server.ts       → Fastify app assembly, route registration
    domain-errors.ts      → DomainError class hierarchy
  plugins/
    error-handler.ts      → catches DomainError/ZodError → HTTP status
    auth-context.ts       → Bearer token → AuthContext resolution
  modules/<domain>/
    *.routes.ts           → Fastify plugin (Zod validation inline)
    *.service.ts          → business logic (constructor-injected deps)
    *.repository.ts       → Drizzle queries (constructor-injected db)
  services/               → cross-cutting (crypto, alerts)
  queue/                  → BullMQ queue wrappers
```

### Error Pattern

```typescript
// Define errors in domain-errors.ts
export class ProjectNotFoundError extends DomainError {
  constructor() {
    super('PROJECT_NOT_FOUND', 'Project not found', 404);
  }
}

// Throw from services — the error-handler plugin maps to HTTP
throw new ProjectNotFoundError();
```

### DI Pattern (Constructor Injection with Defaults)

```typescript
export class DeploymentsService {
  private readonly deploymentsRepository: DeploymentsRepository;

  constructor(
    db: DbClient,
    private readonly deploymentQueue: DeploymentQueue,
    dependencies: DeploymentsServiceDependencies = {}
  ) {
    this.deploymentsRepository =
      dependencies.deploymentsRepository ?? new DeploymentsRepository(db);
  }
}
```

All dependencies are optional for testing — pass mocks in the `dependencies` bag.

### Route Pattern

```typescript
export const createDeploymentsRoutes = (
  deploymentsService: DeploymentsService,
  projectsService: ProjectsService
): FastifyPluginAsync => async (app) => {
  app.post('/projects/:projectId/deployments', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const payload = createDeploymentBodySchema.parse(request.body);
    requireScope(actor, 'deployments:write');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const deployment = await deploymentsService.createDeployment({...});
    return reply.code(201).send({ data: deployment });
  });
};
```

### API Response Shape

- Success: `{ data: ... }`
- Error: `{ code: string, message: string, requestId?: string }`

### Environment Variable Handling

```typescript
// env-core.ts — Zod schema with custom preprocessors
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: envInteger(z.number().default(4000)),
  ENABLE_DEV_AUTH: envBoolean(z.boolean().default(false)),
  ENCRYPTION_KEY: z.string().min(32),
  // ...
});
```

Exported as a singleton from `env.ts`. Access via `env.PORT`, `env.DATABASE_URL`, etc.

---

## Worker (`apps/worker`)

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `bullmq` | 5.16 | Job consumer |
| `dockerode` | 4.0 | Docker Engine API client |
| `pg` | 8.x | PostgreSQL (raw queries, no ORM) |
| `@aws-sdk/client-s3` | 3.x | S3 archive uploads |
| `@azure/storage-blob` | 12.x | Azure archive uploads |
| `google-auth-library` | 9.x | GCS archive uploads |

### Architecture

```
src/
  index.ts                → entry, creates workers
  bootstrap.ts            → createWorkerLifecycle() factory
  config/env-core.ts      → WorkerEnvSchema (Zod)
  logger/logger.ts        → structured JSON logger
  workers/
    deployment.worker.ts            → BullMQ Worker for deploy jobs
    deployment-job-processor.ts     → main job handler
    stop.worker.factory.ts          → Worker for stop jobs
  services/
    deployment-runner.ts            → clone → build → run orchestrator
    caddy.service.ts                → POST/PUT/PATCH/DELETE Caddy admin API
    deployment-state.repository.ts  → raw pg state queries
    deployment-state.service.ts     → state transitions
    runtime/                        → container lifecycle (dockerode)
    build-detection/                → Dockerfile detection + auto-generation
    ingress/                        → routing
    archive-build/, archive-store/  → log archival
```

### Factory Pattern

Worker heavily uses factory functions for wiring:

```typescript
export const deploymentWorker = createConfiguredDeploymentWorker();
```

### Docker Operations

- Worker mounts Docker socket (`//var/run/docker.sock` on Windows, `/var/run/docker.sock` on Linux)
- Deployed containers join the `vcloudrunner-deployments` network
- Container naming: `vcloudrunner-<project-slug>-<deployment-id-prefix>`
- Worker handles cleanup of stale containers on both success and failure paths

---

## Dashboard (`apps/dashboard`)

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.5 | Framework (App Router) |
| `react` | 18.3.1 | UI library |
| `tailwindcss` | 3.4 | Styling |
| `class-variance-authority` | CVA | Component variants (shadcn/ui) |
| `@radix-ui/*` | Various | Accessible primitives |
| `lucide-react` | — | Icons |
| `sonner` | — | Toast notifications |

### Component Pattern (shadcn/ui)

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('...base classes...', {
  variants: { variant: { default: '...', destructive: '...' }, size: { default: '...', sm: '...' } }
});

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
```

### Data Flow

1. **Pages are Server Components by default** — `async function Page()`
2. **Data loads server-side** via `lib/api/*.ts` fetch wrappers
3. **Mutations use Server Actions** (`'use server'` in `actions.ts` files)
4. **Client Components** marked with `'use client'` for interactivity
5. **Auth:** session cookie (`vcloudrunner_dashboard_session`) or `API_AUTH_TOKEN` env var

### Server Action Pattern

```typescript
// app/projects/actions.ts
'use server';
export async function createProjectAction(formData: FormData) {
  const requestAuth = getDashboardRequestAuth();
  // ... validate, call API
  revalidatePath('/projects');
  redirect('/projects?status=success');
}
```

**IMPORTANT:** `redirect()` throws a special Next.js error. It must NEVER be inside a `try/catch` block. Use the `let redirectTo` pattern:

```typescript
let redirectTo: string;
try {
  // ... do work
  redirectTo = '/success-page';
} catch (error) {
  redirectTo = '/error-page';
}
redirect(redirectTo);
```

### UI Rules

Before touching any dashboard UI, read `docs/dashboard-component-usage.md` for required component usage patterns, accessibility rules, and status guidelines.

---

## Shared Types (`packages/shared-types`)

- Pure TypeScript — no runtime dependencies
- Exports types and pure utility functions
- Key exports: `DeploymentStatus`, `ProjectServiceDefinition`, `normalizeProjectServices()`, `getPrimaryProjectService()`
- Built via `tsc` → `dist/`

---

## Database

- **Engine:** PostgreSQL 16
- **ORM:** Drizzle (API only); Worker uses raw `pg` queries
- **Migrations:** Sequential SQL files in `apps/api/drizzle/` (`0000_*.sql`, `0001_*.sql`, ...)
- **Generate:** `npx drizzle-kit generate`
- **Apply:** `npx drizzle-kit migrate` (or auto-applied on API startup)
- **Schema source of truth:** `apps/api/src/db/schema.ts`
- Full schema reference: `docs/database-schema.md`

---

## Testing

| Workspace | Framework | Style |
|-----------|-----------|-------|
| API | `node:test` + `node:assert/strict` | `test('description', async () => { ... })` |
| Worker | `node:test` + `node:assert/strict` | Same as API |
| Dashboard | `vitest` | `describe`/`it`/`expect` |

### Rules

- Test files are **co-located** next to source: `foo.ts` → `foo.test.ts`
- Factory tests use `*.factory.test.ts` naming
- Tests use DI to inject mocks — no monkey-patching
- API/Worker tests run with `tsx --test "src/**/*.test.ts"`
- Dashboard tests run with `npx vitest`

For detailed testing patterns, see `docs/SubAgent docs/testing-conventions.md`.

---

## CI Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Install dependencies (`npm ci`)
2. Lint (`npm run lint`)
3. Typecheck (`npm run typecheck`)
4. Build all workspaces (`npm run build`)

No test step runs in CI currently.
