# Deployment Flow

Canonical single-node MVP pipeline:

1. User triggers deployment.
2. API creates deployment record (`queued`) and computes runtime config defaults.
3. API resolves and decrypts project env vars for the job payload; if that preparation fails after record creation, the deployment is marked `failed` before the original error is returned.
4. API publishes deployment job to BullMQ (Redis).
5. Worker consumes job.
6. Worker clones repository.
7. Worker builds Docker image.
8. Worker starts Docker container with env vars and runtime limits (memory/cpu/non-root user).
9. Worker writes container metadata to Postgres.
10. Worker updates Caddy route for `*.apps.platform.example.com` host.
11. Worker stores logs and updates deployment state (`running` or `failed`).
12. Worker retry policy applies exponential backoff for transient failures and marks non-retryable errors immediately failed.
13. Dashboard can consume logs via list endpoint and live SSE stream endpoint.
14. Worker retention policy prunes old logs by age and per-deployment cap.
15. Optional archive upload sweeps can ship archived logs to object storage using provider-native auth/signing flows (S3 SigV4, GCS bearer OAuth, Azure SharedKey).

Cancellation path:

1. API accepts cancellation only for `queued` and `building` deployments.
2. API records cancellation metadata before attempting queue removal.
3. For queued deployments, the API first tries BullMQ direct `jobId` removal and then scans queued job states to clean up racey or legacy duplicate entries when possible.
4. If any queued entry can still be removed, the API tries to mark the deployment `stopped` immediately.
5. If queue removal succeeded but that final stop-state write fails, the API best-effort marks the deployment `failed` before rethrowing the original error so the project is not left with a stranded active deployment.
6. If queue removal races entirely or the job is already in worker hands, the API still returns a stable "requested" response and the worker cooperatively stops before activation.

Ingress path for end-users:

`Cloudflare -> cloudflared -> caddy -> deployed container`

This flow is intentionally single-node and avoids Kubernetes/service-mesh complexity in MVP.
