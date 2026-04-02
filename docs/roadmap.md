# Vcloudrunner Product Roadmap

Last updated: 2026-03-22

## What This Roadmap Is

This file is the product-direction view of Vcloudrunner.

- [progress.md](./progress.md) tracks implementation slices and engineering progress
- this roadmap tracks what the product should grow into next

The short version:

- today, Vcloudrunner is a single-node self-hosted app deployment platform
- near-term, it should become a better platform for deploying real-world app stacks
- medium-term, it should grow into a platform that can also manage key supporting services, including databases

## Product Direction In Plain English

Vcloudrunner should become the kind of tool where a small team or solo builder can say:

- "Here is my frontend repo"
- "Here is my backend repo"
- "Give me logs, deploys, env vars, domains, and health"
- "Also provision and manage the database I need"

That means the product should evolve from:

- "deploy one Dockerized app from Git"

into:

- "operate a small production-like application stack on one machine"

## Where The Product Stands Today

Current strengths:

- Git-to-Docker-to-runtime deployment flow exists
- dashboard, logs, health, env vars, and API tokens already exist
- deployment lifecycle is much more resilient than it was earlier in MVP work
- worker/runtime internals are being actively decomposed so the platform can grow without collapsing under its own complexity

Current limitations:

- one project is still effectively modeled around one primary runtime
- there is no first-class multi-service app composition model yet
- databases are not managed by the platform today
- auth/account UX is still basic
- operator tooling is good for MVP, but not yet complete enough for a true "platform product"

## Roadmap Themes

The roadmap is organized around five themes:

1. App deployment maturity
2. Multi-service application support
3. Managed data services
4. Operator and team workflows
5. Platform extensibility

## Now

These are the roadmap items that make sense to push next while the current architecture work is still fresh.

### 1. Finish Phase 4 Platform Decomposition ✅

Completed. Worker services are factory-driven with clean seams for runtime, ingress, archive, and state paths.

### 2. Project Composition Model ✅

Completed (2026-04-01). Projects support multiple named services with per-service deployment, settings page for post-creation service management, and deploy-all orchestration.

### 3. Domains, TLS, and Routing UX ✅

Completed (2026-03-14). Domain management page with verification, TLS status, certificate chain observability, domain events, and DNS record guidance.

### 4. Auth and Team Basics ✅

Completed (2026-04-02). Email+password login/registration, session management, team membership with roles, project invitations with claim tokens, token management UI, and route protection middleware.

## Next

These are the most valuable follow-up capabilities once the composition model is in place.

### 5. Managed Databases v1

This should be an explicit roadmap goal.

Why it matters:

- most real apps need a database
- users do not want to manually provision and wire one every time
- this is one of the clearest ways for Vcloudrunner to become a true platform instead of just a deploy runner

Recommended rollout order:

1. Managed Postgres
2. Managed MongoDB
3. Managed Redis

Why this order:

- Postgres fits the existing platform stack and operational model well
- MongoDB is highly desirable and should be supported, but it introduces different operational and backup expectations
- Redis is useful both as an app service and as a future platform add-on

Managed database v1 should include:

- create/delete database instances from the dashboard/API
- generated credentials and connection strings
- automatic env injection into linked services
- storage sizing choices
- health/status display
- backup scheduling
- restore flow
- credential rotation

Managed MongoDB specifically should eventually support:

- a first-class "managed MongoDB" resource
- generated Mongo URI
- persistent volume handling
- backup/restore workflow
- safe upgrade path and operator warnings

Important note:

- managed databases are a very reasonable roadmap item
- they are not "too far away" conceptually
- but they do require the platform to treat persistent services more carefully than disposable app containers

### 6. Deployment Templates and Starters

Why it matters:

- lowers the barrier for new users
- makes common app shapes easy to create

Good starter templates:

- Next.js frontend
- Fastify or Express API
- frontend + API stack
- frontend + API + MongoDB stack
- worker/background-job template

### 7. Rollbacks, Release History, and Promotion

Why it matters:

- once users rely on the platform, they need safer deploy workflows

Target outcomes:

- rollback to prior successful deployment
- mark "current live" vs historical deploys clearly
- compare deployments
- promote a tested deployment rather than rebuilding from scratch

### 8. Preview Environments

Why it matters:

- this is one of the most valuable platform features for modern app teams

Target outcomes:

- branch-based preview deployments
- expiring previews
- isolated env vars
- preview URL lifecycle in dashboard

## Later

These items are valuable, but they should not outrun the foundations above.

### 9. Full Stack Add-Ons Marketplace

Possible add-ons:

- Postgres
- MongoDB
- Redis
- object storage
- background scheduler
- email testing service

### 10. Observability Expansion

Target outcomes:

- richer metrics dashboards
- deployment step timings
- searchable logs
- alert routing UI
- audit trails for critical operator actions

### 11. Policy, Quotas, and Safety Rails

Target outcomes:

- per-project resource quotas
- service count limits
- DB storage limits
- deployment policies
- retention policies

### 12. Multi-Node / Remote Executors

Why it matters:

- this is the bridge from "single machine platform" to "real cluster-like platform"

Target outcomes:

- remote worker/executor nodes
- scheduled placement
- per-node runtime capacity reporting
- more resilient background processing

This should come after:

- multi-service model
- managed persistent services
- stronger operator workflows

## Suggested Priority Order

If we want a practical product path, this is the order that makes the most sense:

1. Finish current Phase 4 decomposition work
2. Add project composition / multi-service apps
3. Improve domains/routing and team/auth UX
4. Add managed databases v1
5. Add rollbacks and preview environments
6. Expand observability and operator controls
7. Explore multi-node execution

## Feature Backlog Worth Considering

These are strong candidate roadmap items even if they are not immediate:

- service-level health checks and restart policies
- per-service deploy configuration in one project
- internal service discovery between services in a project
- secret groups and environment sets
- scheduled jobs / cron-style workloads
- one-click redeploy and rebuild cache controls
- Git provider integrations for deploy hooks and commit status updates
- maintenance mode
- deployment freeze windows
- project cloning
- import/export of project configuration
- backup verification drills for managed databases
- staged rollouts / canaries
- operator audit log UI

## Non-Goals For Right Now

These are probably too early for the product's current stage:

- Kubernetes support
- billing/subscription systems
- complex enterprise SSO
- autoscaling across a real cluster
- broad plugin ecosystems before core stack composition is solid

## The Big Product Bet

If Vcloudrunner keeps going in this direction, the strongest version of the product is:

- simple enough for one person to self-host
- powerful enough to run a small real-world stack
- opinionated enough that app deployment, service wiring, and managed data feel easy

Managed databases absolutely fit that vision.

They should be treated as a major roadmap theme, not a side idea.
