ALTER TABLE "domains"
  ADD COLUMN "ownership_status_changed_at" timestamp with time zone,
  ADD COLUMN "tls_status_changed_at" timestamp with time zone;
