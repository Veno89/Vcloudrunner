import { defineConfig } from 'drizzle-kit';
import { loadEnvFiles } from './src/config/env-loader.js';
import { requireDrizzleDatabaseUrl } from './src/config/drizzle-env.js';

loadEnvFiles();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: requireDrizzleDatabaseUrl(process.env)
  }
});
