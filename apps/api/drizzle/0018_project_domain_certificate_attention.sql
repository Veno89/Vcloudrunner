ALTER TYPE "project_domain_event_kind" ADD VALUE IF NOT EXISTS 'certificate_attention';

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "certificate_guidance_changed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "certificate_guidance_observed_count" integer DEFAULT 0 NOT NULL;
