DO $$ BEGIN
 CREATE TYPE "public"."project_database_engine" AS ENUM('postgres');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."project_database_status" AS ENUM('pending_config', 'provisioning', 'ready', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"engine" "project_database_engine" DEFAULT 'postgres' NOT NULL,
	"name" varchar(48) NOT NULL,
	"status" "project_database_status" DEFAULT 'pending_config' NOT NULL,
	"status_detail" text DEFAULT '' NOT NULL,
	"database_name" varchar(63) NOT NULL,
	"username" varchar(63) NOT NULL,
	"encrypted_password" text NOT NULL,
	"connection_host" varchar(255),
	"connection_port" integer,
	"connection_ssl_mode" varchar(16),
	"provisioned_at" timestamp with time zone,
	"last_provisioning_attempt_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_database_service_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_database_id" uuid NOT NULL,
	"service_name" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_databases" ADD CONSTRAINT "project_databases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_database_service_links" ADD CONSTRAINT "project_database_service_links_project_database_id_project_databases_id_fk" FOREIGN KEY ("project_database_id") REFERENCES "public"."project_databases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_databases_project_name_unique" ON "project_databases" USING btree ("project_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_databases_database_name_unique" ON "project_databases" USING btree ("database_name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_databases_username_unique" ON "project_databases" USING btree ("username");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_databases_project_status_idx" ON "project_databases" USING btree ("project_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_database_service_links_database_service_unique" ON "project_database_service_links" USING btree ("project_database_id","service_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_database_service_links_service_idx" ON "project_database_service_links" USING btree ("service_name");
