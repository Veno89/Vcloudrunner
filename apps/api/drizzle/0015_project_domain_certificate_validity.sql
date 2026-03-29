alter table "domains"
  add column "certificate_valid_from" timestamp with time zone,
  add column "certificate_valid_to" timestamp with time zone;
