DO $$ BEGIN
 CREATE TYPE "public"."project_database_operation_kind" AS ENUM('backup', 'restore');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."project_database_operation_status" AS ENUM('succeeded', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."project_database_event_kind" ADD VALUE IF NOT EXISTS 'backup_operation';
--> statement-breakpoint
ALTER TYPE "public"."project_database_event_kind" ADD VALUE IF NOT EXISTS 'restore_operation';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_database_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"database_id" uuid NOT NULL,
	"kind" "project_database_operation_kind" NOT NULL,
	"status" "project_database_operation_status" NOT NULL,
	"summary" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_operations" ADD CONSTRAINT "project_database_operations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_operations" ADD CONSTRAINT "project_database_operations_database_id_project_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."project_databases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_operations_database_recorded_idx" ON "project_database_operations" USING btree ("database_id","recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_operations_project_recorded_idx" ON "project_database_operations" USING btree ("project_id","recorded_at");
