ALTER TYPE "project_domain_event_kind" ADD VALUE IF NOT EXISTS 'certificate_chain';

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "certificate_chain_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "certificate_root_subject_name" text;
