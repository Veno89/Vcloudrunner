CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN IF NOT EXISTS "token_hash" text;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN IF NOT EXISTS "token_last4" varchar(4);
--> statement-breakpoint
UPDATE "api_tokens"
SET "token_hash" = encode(digest("token", 'sha256'), 'hex'),
    "token_last4" = right("token", 4)
WHERE "token" IS NOT NULL
  AND ("token_hash" IS NULL OR "token_last4" IS NULL);
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "token_hash" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "token_last4" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "token" DROP NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_token_hash_unique" ON "api_tokens" USING btree ("token_hash");
