CREATE TYPE "project_domain_ownership_status" AS ENUM ('managed', 'verified', 'pending', 'mismatch', 'unknown');--> statement-breakpoint

CREATE TYPE "project_domain_tls_status" AS ENUM ('ready', 'pending', 'invalid', 'unknown');--> statement-breakpoint

ALTER TABLE "domains"
ADD COLUMN "ownership_status" "project_domain_ownership_status",
ADD COLUMN "ownership_detail" text,
ADD COLUMN "tls_status" "project_domain_tls_status",
ADD COLUMN "tls_detail" text,
ADD COLUMN "diagnostics_checked_at" timestamp with time zone;--> statement-breakpoint
