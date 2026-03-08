import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

export const deploymentStatus = pgEnum('deployment_status', [
  'queued',
  'building',
  'running',
  'failed',
  'stopped'
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  usersEmailUnique: uniqueIndex('users_email_unique').on(table.email)
}));

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 64 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  gitRepositoryUrl: text('git_repository_url').notNull(),
  defaultBranch: varchar('default_branch', { length: 255 }).notNull().default('main'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  projectsSlugUnique: uniqueIndex('projects_slug_unique').on(table.slug),
  projectsUserIdIdx: index('projects_user_id_idx').on(table.userId)
}));

export const deployments = pgTable('deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  status: deploymentStatus('status').notNull().default('queued'),
  commitSha: varchar('commit_sha', { length: 64 }),
  branch: varchar('branch', { length: 255 }),
  buildLogsUrl: text('build_logs_url'),
  runtimeUrl: text('runtime_url'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true })
}, (table) => ({
  deploymentsProjectIdIdx: index('deployments_project_id_idx').on(table.projectId),
  deploymentsStatusIdx: index('deployments_status_idx').on(table.status)
}));

export const environmentVariables = pgTable('environment_variables', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  key: varchar('key', { length: 255 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  envProjectIdIdx: index('env_project_id_idx').on(table.projectId),
  envProjectKeyUnique: uniqueIndex('env_project_key_unique').on(table.projectId, table.key)
}));

export const containers = pgTable('containers', {
  id: uuid('id').defaultRandom().primaryKey(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id),
  containerId: varchar('container_id', { length: 128 }).notNull(),
  image: varchar('image', { length: 255 }).notNull(),
  internalPort: integer('internal_port').notNull(),
  hostPort: integer('host_port').notNull(),
  isHealthy: boolean('is_healthy').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  containersDeploymentUnique: uniqueIndex('containers_deployment_unique').on(table.deploymentId),
  containersContainerIdUnique: uniqueIndex('containers_container_id_unique').on(table.containerId)
}));

export const domains = pgTable('domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  deploymentId: uuid('deployment_id').references(() => deployments.id),
  host: varchar('host', { length: 255 }).notNull(),
  targetPort: integer('target_port').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  domainsHostUnique: uniqueIndex('domains_host_unique').on(table.host)
}));

export const deploymentLogs = pgTable('deployment_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id),
  level: varchar('level', { length: 16 }).notNull().default('info'),
  message: text('message').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  deploymentLogsDeploymentIdIdx: index('deployment_logs_deployment_id_idx').on(table.deploymentId)
}));
