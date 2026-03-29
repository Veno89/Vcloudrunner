DO $$ BEGIN
 CREATE TYPE "public"."project_database_health_status" AS ENUM('unknown', 'healthy', 'unreachable', 'credentials_invalid', 'failing');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "health_status" "project_database_health_status" DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "health_status_detail" text DEFAULT 'Health checks have not run yet.' NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "health_status_changed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "last_health_check_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "last_healthy_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "last_health_error_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "consecutive_health_check_failures" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "credentials_rotated_at" timestamp with time zone;
