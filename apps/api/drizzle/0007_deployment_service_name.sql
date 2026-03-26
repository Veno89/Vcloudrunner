ALTER TABLE "deployments" ADD COLUMN "service_name" varchar(32);
--> statement-breakpoint
UPDATE "deployments"
SET "service_name" = COALESCE(NULLIF(TRIM(BOTH FROM "metadata"->'service'->>'name'), ''), 'app');
--> statement-breakpoint
ALTER TABLE "deployments" ALTER COLUMN "service_name" SET DEFAULT 'app';
--> statement-breakpoint
ALTER TABLE "deployments" ALTER COLUMN "service_name" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_project_service_name_idx"
ON "deployments" USING btree ("project_id", "service_name");
--> statement-breakpoint
DROP INDEX IF EXISTS "deployments_project_single_active_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployments_project_service_single_active_idx"
ON "deployments" ("project_id", "service_name")
WHERE "status" IN ('queued', 'building', 'running');
