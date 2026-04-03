CREATE TABLE IF NOT EXISTS "github_installations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "installation_id" integer NOT NULL,
  "account_login" varchar(255) NOT NULL,
  "account_type" varchar(32) NOT NULL DEFAULT 'User',
  "permissions" jsonb NOT NULL DEFAULT '{}',
  "installed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "github_installations_user_id_idx" ON "github_installations" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "github_installations_installation_id_unique" ON "github_installations" ("installation_id");
