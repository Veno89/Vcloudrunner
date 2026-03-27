CREATE TABLE IF NOT EXISTS "project_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "email" varchar(320) NOT NULL,
  "role" "project_member_role" NOT NULL DEFAULT 'viewer',
  "invited_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "project_invitations_project_email_unique"
ON "project_invitations" ("project_id", "email");--> statement-breakpoint

CREATE INDEX "project_invitations_project_id_idx"
ON "project_invitations" ("project_id");
