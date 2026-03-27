CREATE TYPE "project_invitation_status" AS ENUM ('pending', 'accepted', 'cancelled');--> statement-breakpoint

ALTER TABLE "project_invitations"
ADD COLUMN "claim_token" varchar(64),
ADD COLUMN "status" "project_invitation_status" DEFAULT 'pending',
ADD COLUMN "accepted_by_user_id" uuid REFERENCES "users"("id"),
ADD COLUMN "accepted_at" timestamp with time zone,
ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint

UPDATE "project_invitations"
SET
  "claim_token" = gen_random_uuid()::text,
  "status" = 'pending'
WHERE "claim_token" IS NULL OR "status" IS NULL;--> statement-breakpoint

ALTER TABLE "project_invitations"
ALTER COLUMN "claim_token" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "project_invitations_project_email_unique";--> statement-breakpoint

CREATE UNIQUE INDEX "project_invitations_claim_token_unique"
ON "project_invitations" ("claim_token");--> statement-breakpoint

CREATE UNIQUE INDEX "project_invitations_project_email_pending_unique"
ON "project_invitations" ("project_id", "email")
WHERE "status" = 'pending';--> statement-breakpoint

CREATE INDEX "project_invitations_project_status_idx"
ON "project_invitations" ("project_id", "status", "updated_at");
