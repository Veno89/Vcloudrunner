# Database Backup Strategy

## Overview

Vcloudrunner uses PostgreSQL 16 as its primary data store. All project metadata, deployment records, environment variables (encrypted), API tokens (hashed), and deployment logs live in the database.

## Backup Approaches

### 1. pg_dump (Recommended for Single-Node)

Run a logical backup on a schedule using `pg_dump`:

```bash
# Full database dump (compressed, custom format)
pg_dump -Fc -h localhost -U postgres -d vcloudrunner > /backups/vcloudrunner_$(date +%Y%m%d_%H%M%S).dump

# Restore from dump
pg_restore -h localhost -U postgres -d vcloudrunner /backups/vcloudrunner_20260312_120000.dump
```

### 2. Automated via Cron

Add a cron job or a Docker sidecar that runs daily backups:

```bash
# /etc/cron.d/vcloudrunner-backup
0 2 * * * postgres pg_dump -Fc -h localhost -U postgres -d vcloudrunner > /backups/vcloudrunner_$(date +\%Y\%m\%d).dump 2>> /var/log/backup.log
```

### 3. Docker Compose Sidecar

Add a backup service to `docker-compose.yml`:

```yaml
services:
  db-backup:
    image: postgres:16-alpine
    depends_on:
      - postgres
    environment:
      PGHOST: postgres
      PGUSER: postgres
      PGPASSWORD: ${POSTGRES_PASSWORD:-postgres}
      PGDATABASE: vcloudrunner
    volumes:
      - ./backups:/backups
    entrypoint: >
      sh -c "while true; do
        pg_dump -Fc > /backups/vcloudrunner_$$(date +%Y%m%d_%H%M%S).dump;
        find /backups -name '*.dump' -mtime +7 -delete;
        sleep 86400;
      done"
```

## Retention Policy

| Tier | Frequency | Retention |
|------|-----------|-----------|
| Daily | Every 24h | 7 days |
| Weekly | Sunday 02:00 | 4 weeks |
| Monthly | 1st of month | 6 months |

## What to Back Up

- **Critical:** `projects`, `deployments`, `api_tokens`, `environment_variables`, `containers`, `domains`
- **Rebuildable:** `deployment_logs` (can be rebuilt from archives if log archival is enabled)

## Restore Procedure

1. Stop the API and worker services
2. Drop and recreate the database (or restore into a new database)
3. Run `pg_restore -Fc -h localhost -U postgres -d vcloudrunner backup.dump`
4. Run pending migrations: `npm run -w apps/api db:push`
5. Restart API and worker services
6. Verify with `/health` and `/health/queue` endpoints

## Verification

Test backups regularly by restoring to a separate database:

```bash
createdb -h localhost -U postgres vcloudrunner_test
pg_restore -Fc -h localhost -U postgres -d vcloudrunner_test backup.dump
psql -h localhost -U postgres -d vcloudrunner_test -c "SELECT count(*) FROM projects;"
dropdb -h localhost -U postgres vcloudrunner_test
```

## Encryption at Rest

If backups contain sensitive data (encrypted env vars, hashed tokens), ensure backup storage is encrypted:
- Use filesystem-level encryption (LUKS, BitLocker)
- Or encrypt the dump file: `pg_dump ... | gpg --encrypt --recipient backup@example.com > backup.dump.gpg`
