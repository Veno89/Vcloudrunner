DO $$ BEGIN
 CREATE TYPE "public"."project_database_backup_artifact_storage_provider" AS ENUM('s3', 'gcs', 'azure', 'local', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."project_database_backup_artifact_integrity_status" AS ENUM('unknown', 'verified', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."project_database_restore_request_status" AS ENUM('requested', 'in_progress', 'succeeded', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."project_database_event_kind" ADD VALUE IF NOT EXISTS 'backup_artifact';
--> statement-breakpoint
ALTER TYPE "public"."project_database_event_kind" ADD VALUE IF NOT EXISTS 'restore_request';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_database_backup_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"database_id" uuid NOT NULL,
	"label" varchar(160) NOT NULL,
	"storage_provider" "project_database_backup_artifact_storage_provider" DEFAULT 'other' NOT NULL,
	"location" text NOT NULL,
	"size_bytes" bigint,
	"produced_at" timestamp with time zone NOT NULL,
	"retention_expires_at" timestamp with time zone,
	"integrity_status" "project_database_backup_artifact_integrity_status" DEFAULT 'unknown' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_database_restore_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"database_id" uuid NOT NULL,
	"backup_artifact_id" uuid,
	"status" "project_database_restore_request_status" DEFAULT 'requested' NOT NULL,
	"target" varchar(160) NOT NULL,
	"summary" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_backup_artifacts" ADD CONSTRAINT "project_database_backup_artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_backup_artifacts" ADD CONSTRAINT "project_database_backup_artifacts_database_id_project_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."project_databases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_restore_requests" ADD CONSTRAINT "project_database_restore_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_restore_requests" ADD CONSTRAINT "project_database_restore_requests_database_id_project_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."project_databases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_restore_requests" ADD CONSTRAINT "project_database_restore_requests_backup_artifact_id_project_database_backup_artifacts_id_fk" FOREIGN KEY ("backup_artifact_id") REFERENCES "public"."project_database_backup_artifacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_backup_artifacts_database_produced_idx" ON "project_database_backup_artifacts" USING btree ("database_id","produced_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_backup_artifacts_project_created_idx" ON "project_database_backup_artifacts" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_restore_requests_database_requested_idx" ON "project_database_restore_requests" USING btree ("database_id","requested_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_restore_requests_project_created_idx" ON "project_database_restore_requests" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_restore_requests_backup_artifact_idx" ON "project_database_restore_requests" USING btree ("backup_artifact_id");
