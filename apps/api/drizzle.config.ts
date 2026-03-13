import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: resolve(process.cwd(), 'apps/api/.env'), override: true });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/vcloudrunner'
  }
});
