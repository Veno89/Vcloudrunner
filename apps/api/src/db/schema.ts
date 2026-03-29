import { sql } from 'drizzle-orm';
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
import {
  DEFAULT_PROJECT_SERVICE_NAME,
  createDefaultProjectServices,
  type ProjectServiceDefinition
} from '@vcloudrunner/shared-types';

export const deploymentStatus = pgEnum('deployment_status', [
  'queued',
  'building',
  'running',
  'failed',
  'stopped'
]);

export const projectMemberRole = pgEnum('project_member_role', [
  'viewer',
  'editor',
  'admin'
]);

export const projectInvitationStatus = pgEnum('project_invitation_status', [
  'pending',
  'accepted',
  'cancelled'
]);

export const projectDatabaseEngine = pgEnum('project_database_engine', [
  'postgres'
]);

export const projectDatabaseStatus = pgEnum('project_database_status', [
  'pending_config',
  'provisioning',
  'ready',
  'failed'
]);

export const projectDatabaseHealthStatus = pgEnum('project_database_health_status', [
  'unknown',
  'healthy',
  'unreachable',
  'credentials_invalid',
  'failing'
]);

export const projectDomainOwnershipStatus = pgEnum('project_domain_ownership_status', [
  'managed',
  'verified',
  'pending',
  'mismatch',
  'unknown'
]);

export const projectDomainVerificationStatus = pgEnum('project_domain_verification_status', [
  'managed',
  'verified',
  'pending',
  'mismatch',
  'unknown'
]);

export const projectDomainTlsStatus = pgEnum('project_domain_tls_status', [
  'ready',
  'pending',
  'invalid',
  'unknown'
]);

export const projectDomainEventKind = pgEnum('project_domain_event_kind', [
  'ownership',
  'tls',
  'certificate',
  'certificate_trust',
  'certificate_path_validity',
  'certificate_identity',
  'certificate_attention',
  'certificate_chain'
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

export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  token: text('token'),
  tokenHash: text('token_hash').notNull(),
  tokenLast4: varchar('token_last4', { length: 4 }).notNull(),
  role: varchar('role', { length: 16 }).notNull().default('user'),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  label: varchar('label', { length: 128 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  apiTokensTokenUnique: uniqueIndex('api_tokens_token_unique').on(table.token),
  apiTokensTokenHashUnique: uniqueIndex('api_tokens_token_hash_unique').on(table.tokenHash),
  apiTokensUserIdIdx: index('api_tokens_user_id_idx').on(table.userId)
}));

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 64 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  gitRepositoryUrl: text('git_repository_url').notNull(),
  defaultBranch: varchar('default_branch', { length: 255 }).notNull().default('main'),
  services: jsonb('services').$type<ProjectServiceDefinition[]>().notNull().default(createDefaultProjectServices()),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  projectsSlugUnique: uniqueIndex('projects_slug_unique').on(table.slug),
  projectsUserIdIdx: index('projects_user_id_idx').on(table.userId)
}));

export const deployments = pgTable('deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  serviceName: varchar('service_name', { length: 32 }).notNull().default(DEFAULT_PROJECT_SERVICE_NAME),
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
  deploymentsProjectServiceNameIdx: index('deployments_project_service_name_idx').on(table.projectId, table.serviceName),
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
  verificationToken: varchar('verification_token', { length: 96 }),
  verificationStatus: projectDomainVerificationStatus('verification_status'),
  verificationDetail: text('verification_detail'),
  verificationCheckedAt: timestamp('verification_checked_at', { withTimezone: true }),
  verificationStatusChangedAt: timestamp('verification_status_changed_at', { withTimezone: true }),
  verificationVerifiedAt: timestamp('verification_verified_at', { withTimezone: true }),
  ownershipStatus: projectDomainOwnershipStatus('ownership_status'),
  ownershipDetail: text('ownership_detail'),
  tlsStatus: projectDomainTlsStatus('tls_status'),
  tlsDetail: text('tls_detail'),
  certificateValidFrom: timestamp('certificate_valid_from', { withTimezone: true }),
  certificateValidTo: timestamp('certificate_valid_to', { withTimezone: true }),
  certificateSubjectName: text('certificate_subject_name'),
  certificateIssuerName: text('certificate_issuer_name'),
  certificateSubjectAltNames: jsonb('certificate_subject_alt_names').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  certificateChainSubjects: jsonb('certificate_chain_subjects').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  certificateChainEntries: jsonb('certificate_chain_entries').$type<Array<{
    subjectName: string | null;
    issuerName: string | null;
    fingerprintSha256: string | null;
    serialNumber: string | null;
    isSelfIssued: boolean;
    validFrom?: Date | null;
    validTo?: Date | null;
  }>>().notNull().default(sql`'[]'::jsonb`),
  certificateRootSubjectName: text('certificate_root_subject_name'),
  certificateChainChangedAt: timestamp('certificate_chain_changed_at', { withTimezone: true }),
  certificateChainObservedCount: integer('certificate_chain_observed_count').notNull().default(0),
  certificateChainLastHealthyAt: timestamp('certificate_chain_last_healthy_at', { withTimezone: true }),
  certificateLastHealthyChainEntries: jsonb('certificate_last_healthy_chain_entries').$type<Array<{
    subjectName: string | null;
    issuerName: string | null;
    fingerprintSha256: string | null;
    serialNumber: string | null;
    isSelfIssued: boolean;
    validFrom?: Date | null;
    validTo?: Date | null;
  }>>().notNull().default(sql`'[]'::jsonb`),
  certificatePathValidityChangedAt: timestamp('certificate_path_validity_changed_at', { withTimezone: true }),
  certificatePathValidityObservedCount: integer('certificate_path_validity_observed_count').notNull().default(0),
  certificatePathValidityLastHealthyAt: timestamp('certificate_path_validity_last_healthy_at', { withTimezone: true }),
  certificateValidationReason: varchar('certificate_validation_reason', { length: 64 }),
  certificateFingerprintSha256: varchar('certificate_fingerprint_sha256', { length: 128 }),
  certificateSerialNumber: varchar('certificate_serial_number', { length: 128 }),
  certificateFirstObservedAt: timestamp('certificate_first_observed_at', { withTimezone: true }),
  certificateChangedAt: timestamp('certificate_changed_at', { withTimezone: true }),
  certificateLastRotatedAt: timestamp('certificate_last_rotated_at', { withTimezone: true }),
  certificateGuidanceChangedAt: timestamp('certificate_guidance_changed_at', { withTimezone: true }),
  certificateGuidanceObservedCount: integer('certificate_guidance_observed_count').notNull().default(0),
  diagnosticsCheckedAt: timestamp('diagnostics_checked_at', { withTimezone: true }),
  ownershipStatusChangedAt: timestamp('ownership_status_changed_at', { withTimezone: true }),
  tlsStatusChangedAt: timestamp('tls_status_changed_at', { withTimezone: true }),
  ownershipVerifiedAt: timestamp('ownership_verified_at', { withTimezone: true }),
  tlsReadyAt: timestamp('tls_ready_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  domainsHostUnique: uniqueIndex('domains_host_unique').on(table.host)
}));

export const projectDomainEvents = pgTable('project_domain_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  domainId: uuid('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  kind: projectDomainEventKind('kind').notNull(),
  previousStatus: varchar('previous_status', { length: 32 }),
  nextStatus: varchar('next_status', { length: 32 }).notNull(),
  detail: text('detail').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  projectDomainEventsDomainCreatedIdx: index('project_domain_events_domain_created_idx')
    .on(table.domainId, table.createdAt),
  projectDomainEventsProjectCreatedIdx: index('project_domain_events_project_created_idx')
    .on(table.projectId, table.createdAt)
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

export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: projectMemberRole('role').notNull().default('viewer'),
  invitedBy: uuid('invited_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  projectMembersProjectUserUnique: uniqueIndex('project_members_project_user_unique').on(table.projectId, table.userId),
  projectMembersUserIdIdx: index('project_members_user_id_idx').on(table.userId)
}));

export const projectInvitations = pgTable('project_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }).notNull(),
  claimToken: varchar('claim_token', { length: 64 }).notNull(),
  role: projectMemberRole('role').notNull().default('viewer'),
  status: projectInvitationStatus('status').notNull().default('pending'),
  invitedBy: uuid('invited_by').references(() => users.id),
  acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  projectInvitationsClaimTokenUnique: uniqueIndex('project_invitations_claim_token_unique').on(table.claimToken),
  projectInvitationsProjectEmailPendingUnique: uniqueIndex('project_invitations_project_email_pending_unique')
    .on(table.projectId, table.email)
    .where(sql`${table.status} = 'pending'`),
  projectInvitationsProjectStatusIdx: index('project_invitations_project_status_idx')
    .on(table.projectId, table.status, table.updatedAt)
}));

export const projectDatabases = pgTable('project_databases', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  engine: projectDatabaseEngine('engine').notNull().default('postgres'),
  name: varchar('name', { length: 48 }).notNull(),
  status: projectDatabaseStatus('status').notNull().default('pending_config'),
  statusDetail: text('status_detail').notNull().default(''),
  databaseName: varchar('database_name', { length: 63 }).notNull(),
  username: varchar('username', { length: 63 }).notNull(),
  encryptedPassword: text('encrypted_password').notNull(),
  connectionHost: varchar('connection_host', { length: 255 }),
  connectionPort: integer('connection_port'),
  connectionSslMode: varchar('connection_ssl_mode', { length: 16 }),
  healthStatus: projectDatabaseHealthStatus('health_status').notNull().default('unknown'),
  healthStatusDetail: text('health_status_detail').notNull().default('Health checks have not run yet.'),
  healthStatusChangedAt: timestamp('health_status_changed_at', { withTimezone: true }),
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  lastHealthyAt: timestamp('last_healthy_at', { withTimezone: true }),
  lastHealthErrorAt: timestamp('last_health_error_at', { withTimezone: true }),
  consecutiveHealthCheckFailures: integer('consecutive_health_check_failures').notNull().default(0),
  credentialsRotatedAt: timestamp('credentials_rotated_at', { withTimezone: true }),
  provisionedAt: timestamp('provisioned_at', { withTimezone: true }),
  lastProvisioningAttemptAt: timestamp('last_provisioning_attempt_at', { withTimezone: true }),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  projectDatabasesProjectNameUnique: uniqueIndex('project_databases_project_name_unique')
    .on(table.projectId, table.name),
  projectDatabasesDatabaseNameUnique: uniqueIndex('project_databases_database_name_unique')
    .on(table.databaseName),
  projectDatabasesUsernameUnique: uniqueIndex('project_databases_username_unique')
    .on(table.username),
  projectDatabasesProjectStatusIdx: index('project_databases_project_status_idx')
    .on(table.projectId, table.status)
}));

export const projectDatabaseServiceLinks = pgTable('project_database_service_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectDatabaseId: uuid('project_database_id').notNull().references(() => projectDatabases.id, { onDelete: 'cascade' }),
  serviceName: varchar('service_name', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  projectDatabaseServiceLinksDatabaseServiceUnique: uniqueIndex('project_database_service_links_database_service_unique')
    .on(table.projectDatabaseId, table.serviceName),
  projectDatabaseServiceLinksServiceIdx: index('project_database_service_links_service_idx')
    .on(table.serviceName)
}));
