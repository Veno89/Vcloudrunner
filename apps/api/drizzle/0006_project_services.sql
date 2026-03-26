ALTER TABLE "projects"
ADD COLUMN "services" jsonb NOT NULL DEFAULT '[{"name":"app","kind":"web","sourceRoot":".","exposure":"public"}]'::jsonb;
