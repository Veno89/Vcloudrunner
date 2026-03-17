# PR: Harden deployment cancellation races and align auth/compose guidance

## Motivation

Deployment cancellation needed one more hardening pass around queue races and partial failures, and the operator docs still mixed direct workspace `.env` setup with the production-like compose path. This PR keeps API/domain behavior stable while tightening cancellation resilience and bringing the README/progress notes back in sync with the current auth and compose defaults.

## Exact Changes

- fall back to queued-job scanning when BullMQ direct `getJob(deploymentId)` lookup fails during cancellation
- keep cancellation responses stable when the state change succeeds but the follow-up deployment log insert fails
- add API unit coverage for queue lookup failure fallback and cancellation log partial-failure behavior
- align dashboard deployment filtering/status badges with the backend `stopped` status while preserving backward compatibility for legacy `status=cancelled` URLs
- align remaining dashboard deployment surfaces to the shared deployment status enum and show explicit stopped/cancelled guidance on deployment detail pages
- clarify compose quick start requirements for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ENCRYPTION_KEY`, optional dashboard auth variables, and the separation from app-local `.env` files
- document the current cancellation semantics and refresh progress wording so `ENABLE_DEV_AUTH`, `API_TOKENS_JSON`, and `stopped` status references match the implementation
- make `apps/api/.env.example` explicitly show `ENABLE_DEV_AUTH=false` alongside the bootstrap token fallback example

## Tests Run

- `npm --workspace @vcloudrunner/api test`
  - passed (`44/44`); required elevated execution in this environment because the default Windows sandbox hit `spawn EPERM`
- `npm run typecheck`
  - passed
