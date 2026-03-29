alter type "project_domain_event_kind" add value if not exists 'certificate';

alter table "domains"
  add column "certificate_subject_name" text,
  add column "certificate_issuer_name" text,
  add column "certificate_subject_alt_names" jsonb not null default '[]'::jsonb,
  add column "certificate_validation_reason" varchar(64);
