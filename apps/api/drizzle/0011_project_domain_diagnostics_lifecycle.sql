alter table "domains"
  add column "ownership_verified_at" timestamp with time zone,
  add column "tls_ready_at" timestamp with time zone;
