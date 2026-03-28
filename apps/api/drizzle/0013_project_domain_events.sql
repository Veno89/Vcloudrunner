CREATE TYPE "project_domain_event_kind" AS ENUM ('ownership', 'tls');

CREATE TABLE "project_domain_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "domain_id" uuid NOT NULL,
  "kind" "project_domain_event_kind" NOT NULL,
  "previous_status" varchar(32),
  "next_status" varchar(32) NOT NULL,
  "detail" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "project_domain_events"
  ADD CONSTRAINT "project_domain_events_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "project_domain_events"
  ADD CONSTRAINT "project_domain_events_domain_id_domains_id_fk"
  FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "project_domain_events_domain_created_idx"
  ON "project_domain_events" USING btree ("domain_id","created_at");

CREATE INDEX "project_domain_events_project_created_idx"
  ON "project_domain_events" USING btree ("project_id","created_at");
