create type "public"."project_domain_verification_status" as enum('managed', 'verified', 'pending', 'mismatch', 'unknown');

alter table "domains"
  add column "verification_token" varchar(96),
  add column "verification_status" "project_domain_verification_status",
  add column "verification_detail" text,
  add column "verification_checked_at" timestamp with time zone,
  add column "verification_status_changed_at" timestamp with time zone,
  add column "verification_verified_at" timestamp with time zone;
