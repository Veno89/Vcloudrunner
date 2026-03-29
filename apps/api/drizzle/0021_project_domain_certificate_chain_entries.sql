ALTER TABLE "domains"
  ADD COLUMN "certificate_chain_entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN "certificate_last_healthy_chain_entries" jsonb DEFAULT '[]'::jsonb NOT NULL;
