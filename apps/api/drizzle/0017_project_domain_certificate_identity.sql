alter type "project_domain_event_kind" add value if not exists 'certificate_identity';

alter table "domains"
  add column "certificate_fingerprint_sha256" varchar(128),
  add column "certificate_serial_number" varchar(128),
  add column "certificate_first_observed_at" timestamp with time zone,
  add column "certificate_changed_at" timestamp with time zone,
  add column "certificate_last_rotated_at" timestamp with time zone;
