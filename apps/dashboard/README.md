# Dashboard Service

Next.js dashboard scaffold for the single-node Vcloudrunner MVP.

## Current scope

- project list + creation form (API-backed with fallback to mock data)
- deployment table (API-backed with fallback to mock data)
- deployment trigger action (server action -> API)
- environment variable editor (project selector + list/add/delete via API)
- deployment logs viewer with deployment selector, optional 5-second auto-refresh, and live SSE stream panel

## Next

- improve live log stream resiliency/reconnect UX (current transport: SSE)
- add optimistic create UX (disable/pending state) and field-level validation messaging

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`)
- `NEXT_PUBLIC_DEMO_USER_ID` (required for project listing/selection path in demo UX)
- `API_AUTH_TOKEN` (server-side bearer token used by dashboard when calling API)
  - prefer a DB-backed token from `/v1/users/:userId/api-tokens` or an explicit `API_TOKENS_JSON` bootstrap token
  - `dev-admin-token` is only valid when the API has `ENABLE_DEV_AUTH=true`, which should remain a local-only opt-in bypass
