CREATE UNIQUE INDEX IF NOT EXISTS "deployments_project_single_active_idx"
ON "deployments" ("project_id")
WHERE "status" IN ('queued', 'building', 'running');
