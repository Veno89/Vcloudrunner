# Dashboard Service

Next.js dashboard scaffold for the single-node Vcloudrunner MVP.

## Current scope

- project list (API-backed with fallback to mock data)
- deployment table (API-backed with fallback to mock data)
- deployment trigger action (server action -> API)
- environment variable editor (list/add/delete via API for selected demo project)

## Next

- add logs viewer stream / polling controls
- add project selector for env variable editor

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`)
- `NEXT_PUBLIC_DEMO_USER_ID` (optional demo user for API-backed project list)
