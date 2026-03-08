# Worker Service

BullMQ worker service that executes deployment jobs.

## Responsibilities

- consume deployment jobs from Redis queue
- clone git repositories
- build Docker images
- start Docker containers
- update deployment/container/domain state in Postgres
- upsert Caddy routes via Caddy Admin API
- persist deployment logs

## Notes

Current implementation is an MVP skeleton and intentionally leaves advanced concerns (buildpack detection, rollout strategy, resource quotas, log streaming multiplexing) for upcoming phases.
