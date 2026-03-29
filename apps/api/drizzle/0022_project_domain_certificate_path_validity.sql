ALTER TABLE "domains"
  ADD COLUMN "certificate_path_validity_changed_at" timestamp with time zone,
  ADD COLUMN "certificate_path_validity_observed_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "certificate_path_validity_last_healthy_at" timestamp with time zone;
