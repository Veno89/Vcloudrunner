ALTER TABLE "domains"
  ADD COLUMN "certificate_chain_changed_at" timestamp with time zone,
  ADD COLUMN "certificate_chain_observed_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "certificate_chain_last_healthy_at" timestamp with time zone;
