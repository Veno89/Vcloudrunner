DO $$ BEGIN
 CREATE TYPE "public"."project_database_backup_mode" AS ENUM('none', 'external');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."project_database_backup_schedule" AS ENUM('daily', 'weekly', 'monthly', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."project_database_event_kind" AS ENUM('provisioning', 'runtime_health', 'credentials', 'backup_policy', 'recovery_check');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "backup_mode" "project_database_backup_mode" DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "backup_schedule" "project_database_backup_schedule";
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "backup_runbook" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "backup_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "project_databases"
  ADD COLUMN IF NOT EXISTS "restore_verified_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_database_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"database_id" uuid NOT NULL,
	"kind" "project_database_event_kind" NOT NULL,
	"previous_status" varchar(48),
	"next_status" varchar(48) NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_events" ADD CONSTRAINT "project_database_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_events" ADD CONSTRAINT "project_database_events_database_id_project_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."project_databases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_events_database_created_idx" ON "project_database_events" USING btree ("database_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_events_project_created_idx" ON "project_database_events" USING btree ("project_id","created_at");
