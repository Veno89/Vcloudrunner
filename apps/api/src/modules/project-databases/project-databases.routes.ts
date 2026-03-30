import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  ensureProjectAccess,
  ensureProjectMembershipManagementAccess,
  requireActor,
  requireScope
} from '../auth/auth-utils.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { ProjectDatabasesService } from './project-databases.service.js';

const projectByIdParamsSchema = z.object({
  projectId: z.string().uuid()
});

const projectDatabaseByIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  databaseId: z.string().uuid()
});

const projectDatabaseBackupArtifactByIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  databaseId: z.string().uuid(),
  backupArtifactId: z.string().uuid()
});

const projectDatabaseRestoreRequestByIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  databaseId: z.string().uuid(),
  restoreRequestId: z.string().uuid()
});

const serviceNamesSchema = z.array(
  z.string().trim().min(1).max(32).regex(/^[a-z][a-z0-9-]*$/)
).max(12);

const createProjectDatabaseSchema = z.object({
  name: z.string().trim().toLowerCase().min(1).max(48).regex(/^[a-z][a-z0-9-]*$/),
  serviceNames: serviceNamesSchema.default([])
});

const updateProjectDatabaseServiceLinksSchema = z.object({
  serviceNames: serviceNamesSchema.default([])
});

const updateProjectDatabaseBackupPolicySchema = z.object({
  backupMode: z.enum(['none', 'external']),
  backupSchedule: z.enum(['daily', 'weekly', 'monthly', 'custom']).nullable().default(null),
  backupRunbook: z.string().trim().max(2000).default('')
}).superRefine((value, context) => {
  if (value.backupMode === 'external' && value.backupRunbook.trim().length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['backupRunbook'],
      message: 'Document the external backup and recovery process before enabling external backup coverage.'
    });
  }
});

const recordProjectDatabaseRecoveryCheckSchema = z.object({
  kind: z.enum(['backup', 'restore']),
  status: z.enum(['succeeded', 'failed']).default('succeeded'),
  summary: z.string().trim().max(160).default(''),
  detail: z.string().trim().max(2000).default('')
});

const recordProjectDatabaseBackupArtifactSchema = z.object({
  label: z.string().trim().min(1).max(160),
  storageProvider: z.enum(['s3', 'gcs', 'azure', 'local', 'other']).default('other'),
  location: z.string().trim().min(1).max(1000),
  sizeBytes: z.number().int().positive().nullable().default(null),
  producedAt: z.string().datetime({ offset: true }),
  retentionExpiresAt: z.string().datetime({ offset: true }).nullable().default(null),
  integrityStatus: z.enum(['unknown', 'verified', 'failed']).default('unknown'),
  detail: z.string().trim().max(2000).default('')
});

const updateProjectDatabaseBackupArtifactSchema = z.object({
  integrityStatus: z.enum(['unknown', 'verified', 'failed']),
  lifecycleStatus: z.enum(['active', 'archived', 'purged']),
  retentionExpiresAt: z.string().datetime({ offset: true }).nullable().default(null),
  detail: z.string().trim().max(2000).default('')
});

const createProjectDatabaseRestoreRequestSchema = z.object({
  backupArtifactId: z.string().uuid().nullable().default(null),
  target: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(2000).default('')
});

const reviewProjectDatabaseRestoreRequestSchema = z.object({
  approvalStatus: z.enum(['approved', 'rejected']),
  approvalDetail: z.string().trim().max(2000).default('')
});

const updateProjectDatabaseRestoreRequestSchema = z.object({
  status: z.enum(['requested', 'in_progress', 'succeeded', 'failed', 'cancelled']),
  detail: z.string().trim().max(2000).default('')
});

export const createProjectDatabasesRoutes = (
  projectDatabasesService: ProjectDatabasesService,
  projectsService: ProjectsService
): FastifyPluginAsync => async (app) => {
  app.get('/projects/:projectId/databases', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:read');
    await ensureProjectAccess(projectsService, { projectId, actor });

    const databases = await projectDatabasesService.listProjectDatabases(projectId);

    return { data: databases };
  });

  app.get('/projects/:projectId/databases/:databaseId/audit/export', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:read');
    await ensureProjectAccess(projectsService, { projectId, actor });

    const auditExport = await projectDatabasesService.getProjectDatabaseAuditExport({
      projectId,
      databaseId
    });

    reply.header('content-type', 'application/json; charset=utf-8');
    reply.header('content-disposition', `attachment; filename="project-database-${databaseId}-audit.json"`);
    return auditExport;
  });

  app.post('/projects/:projectId/databases', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);
    const payload = createProjectDatabaseSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.createProjectDatabase({
      projectId,
      name: payload.name,
      serviceNames: payload.serviceNames
    });

    return reply.code(201).send({ data: database });
  });

  app.post('/projects/:projectId/databases/:databaseId/reconcile', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.reconcileProjectDatabase({
      projectId,
      databaseId
    });

    return { data: database };
  });

  app.post('/projects/:projectId/databases/:databaseId/rotate-credentials', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.rotateProjectDatabaseCredentials({
      projectId,
      databaseId
    });

    return { data: database };
  });

  app.put('/projects/:projectId/databases/:databaseId/backup-policy', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);
    const payload = updateProjectDatabaseBackupPolicySchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.updateProjectDatabaseBackupPolicy({
      projectId,
      databaseId,
      backupMode: payload.backupMode,
      backupSchedule: payload.backupMode === 'external' ? payload.backupSchedule : null,
      backupRunbook: payload.backupRunbook
    });

    return { data: database };
  });

  app.post('/projects/:projectId/databases/:databaseId/recovery-checks', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);
    const payload = recordProjectDatabaseRecoveryCheckSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.recordProjectDatabaseRecoveryCheck({
      projectId,
      databaseId,
      kind: payload.kind,
      status: payload.status,
      summary: payload.summary,
      detail: payload.detail
    });

    return { data: database };
  });

  app.post('/projects/:projectId/databases/:databaseId/backup-artifacts', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);
    const payload = recordProjectDatabaseBackupArtifactSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.recordProjectDatabaseBackupArtifact({
      projectId,
      databaseId,
      label: payload.label,
      storageProvider: payload.storageProvider,
      location: payload.location,
      sizeBytes: payload.sizeBytes,
      producedAt: new Date(payload.producedAt),
      retentionExpiresAt: payload.retentionExpiresAt ? new Date(payload.retentionExpiresAt) : null,
      integrityStatus: payload.integrityStatus,
      detail: payload.detail
    });

    return { data: database };
  });

  app.put('/projects/:projectId/databases/:databaseId/backup-artifacts/:backupArtifactId', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId, backupArtifactId } =
      projectDatabaseBackupArtifactByIdParamsSchema.parse(request.params);
    const payload = updateProjectDatabaseBackupArtifactSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.updateProjectDatabaseBackupArtifact({
      projectId,
      databaseId,
      backupArtifactId,
      integrityStatus: payload.integrityStatus,
      lifecycleStatus: payload.lifecycleStatus,
      retentionExpiresAt: payload.retentionExpiresAt ? new Date(payload.retentionExpiresAt) : null,
      detail: payload.detail
    });

    return { data: database };
  });

  app.post('/projects/:projectId/databases/:databaseId/restore-requests', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);
    const payload = createProjectDatabaseRestoreRequestSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.createProjectDatabaseRestoreRequest({
      projectId,
      databaseId,
      backupArtifactId: payload.backupArtifactId,
      target: payload.target,
      summary: payload.summary,
      detail: payload.detail
    });

    return { data: database };
  });

  app.put('/projects/:projectId/databases/:databaseId/restore-requests/:restoreRequestId/approval', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId, restoreRequestId } =
      projectDatabaseRestoreRequestByIdParamsSchema.parse(request.params);
    const payload = reviewProjectDatabaseRestoreRequestSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.reviewProjectDatabaseRestoreRequest({
      projectId,
      databaseId,
      restoreRequestId,
      approvalStatus: payload.approvalStatus,
      approvalDetail: payload.approvalDetail
    });

    return { data: database };
  });

  app.put('/projects/:projectId/databases/:databaseId/restore-requests/:restoreRequestId', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId, restoreRequestId } =
      projectDatabaseRestoreRequestByIdParamsSchema.parse(request.params);
    const payload = updateProjectDatabaseRestoreRequestSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.updateProjectDatabaseRestoreRequest({
      projectId,
      databaseId,
      restoreRequestId,
      status: payload.status,
      detail: payload.detail
    });

    return { data: database };
  });

  app.put('/projects/:projectId/databases/:databaseId/service-links', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);
    const payload = updateProjectDatabaseServiceLinksSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.updateProjectDatabaseServiceLinks({
      projectId,
      databaseId,
      serviceNames: payload.serviceNames
    });

    return { data: database };
  });

  app.delete('/projects/:projectId/databases/:databaseId', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    await projectDatabasesService.removeProjectDatabase({
      projectId,
      databaseId
    });

    return reply.code(204).send();
  });
};
