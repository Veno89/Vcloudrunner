# Deployment Flow

Canonical single-node MVP pipeline:

1. User triggers deployment.
2. API creates deployment record (`queued`) and computes runtime config defaults.
3. API publishes deployment job to BullMQ (Redis).
4. Worker consumes job.
5. Worker clones repository.
6. Worker builds Docker image.
7. Worker starts Docker container with env vars and runtime limits (memory/cpu/non-root user).
8. Worker writes container metadata to Postgres.
9. Worker updates Caddy route for `*.apps.platform.example.com` host.
10. Worker stores logs and updates deployment state (`running` or `failed`).
11. Worker retry policy applies exponential backoff for transient failures and marks non-retryable errors immediately failed.
12. Dashboard can consume logs via list endpoint and live SSE stream endpoint.
13. Worker retention policy prunes old logs by age and per-deployment cap.
14. Optional archive upload sweeps can ship archived logs to object storage using provider-native auth/signing flows (S3 SigV4, GCS bearer OAuth, Azure SharedKey).

Cancellation path:

1. API accepts cancellation only for `queued` and `building` deployments.
2. API records cancellation metadata before attempting queue removal.
3. If the deployment is still queued and BullMQ removal succeeds, the deployment is marked `stopped` immediately.
4. If queue removal races or the job is already in worker hands, the API still returns a stable "requested" response and the worker cooperatively stops before activation.

Ingress path for end-users:

`Cloudflare -> cloudflared -> caddy -> deployed container`

This flow is intentionally single-node and avoids Kubernetes/service-mesh complexity in MVP.
