# Dashboard Service

Next.js dashboard scaffold for the single-node Vcloudrunner MVP.

## Current scope

- project list (API-backed with fallback to mock data)
- deployment table (API-backed with fallback to mock data)
- deployment trigger action (server action -> API)
- environment variable editor (project selector + list/add/delete via API)
- deployment logs viewer with deployment selector and optional 5-second auto-refresh

## Next

- add true live log streaming transport (websocket/sse)

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`)
- `NEXT_PUBLIC_DEMO_USER_ID` (optional demo user for API-backed project list)
