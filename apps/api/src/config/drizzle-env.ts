export function requireDrizzleDatabaseUrl(source: NodeJS.ProcessEnv) {
  const databaseUrl = source.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for drizzle-kit commands');
  }

  return databaseUrl;
}
