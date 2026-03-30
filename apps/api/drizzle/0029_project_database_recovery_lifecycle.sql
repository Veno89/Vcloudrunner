CREATE TYPE "public"."project_database_backup_artifact_lifecycle_status" AS ENUM('active', 'archived', 'purged');
CREATE TYPE "public"."project_database_restore_request_approval_status" AS ENUM('pending', 'approved', 'rejected');

ALTER TABLE "project_database_backup_artifacts"
  ADD COLUMN "lifecycle_status" "project_database_backup_artifact_lifecycle_status" DEFAULT 'active' NOT NULL,
  ADD COLUMN "verified_at" timestamp with time zone,
  ADD COLUMN "lifecycle_changed_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "project_database_restore_requests"
  ADD COLUMN "approval_status" "project_database_restore_request_approval_status" DEFAULT 'pending' NOT NULL,
  ADD COLUMN "approval_detail" text DEFAULT '' NOT NULL,
  ADD COLUMN "approval_reviewed_at" timestamp with time zone;
