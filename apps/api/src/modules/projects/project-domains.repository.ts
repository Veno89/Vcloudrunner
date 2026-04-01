import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type {
  ProjectDomainCertificateChainEntry,
  ProjectDomainCertificateValidationReason,
  ProjectDomainVerificationStatus,
  ProjectDomainOwnershipStatus,
  ProjectDomainTlsStatus
} from '../../services/project-domain-diagnostics.service.js';

import type { DbClient } from '../../db/client.js';
import {
  deployments,
  domains,
  projectDomainEvents
} from '../../db/schema.js';

import type {
  CreateProjectDomainEventInput,
  CreateProjectDomainInput,
  ProjectDomainEventKind,
  ProjectDomainEventRecord,
  ProjectDomainRecord,
  UpdateProjectDomainDiagnosticsInput
} from './projects.repository.types.js';

function toDeploymentServiceMetadata(input: {
  serviceName: string | null;
  metadata: unknown;
}) {
  if (!input.metadata || typeof input.metadata !== 'object' || Array.isArray(input.metadata)) {
    return {
      serviceName: input.serviceName,
      serviceKind: null,
      serviceExposure: null
    } satisfies Pick<ProjectDomainRecord, 'serviceName' | 'serviceKind' | 'serviceExposure'>;
  }

  const service = (input.metadata as { service?: unknown }).service;
  if (!service || typeof service !== 'object' || Array.isArray(service)) {
    return {
      serviceName: input.serviceName,
      serviceKind: null,
      serviceExposure: null
    } satisfies Pick<ProjectDomainRecord, 'serviceName' | 'serviceKind' | 'serviceExposure'>;
  }

  const serviceName = typeof (service as { name?: unknown }).name === 'string'
    ? (service as { name: string }).name
    : input.serviceName;
  const kind = (service as { kind?: unknown }).kind;
  const exposure = (service as { exposure?: unknown }).exposure;

  return {
    serviceName,
    serviceKind: kind === 'web' || kind === 'worker' ? kind : null,
    serviceExposure: exposure === 'public' || exposure === 'internal' ? exposure : null
  } satisfies Pick<ProjectDomainRecord, 'serviceName' | 'serviceKind' | 'serviceExposure'>;
}

function toCertificateValidationReason(
  value: string | null
): ProjectDomainCertificateValidationReason | null {
  switch (value) {
    case 'self-signed':
    case 'hostname-mismatch':
    case 'issuer-untrusted':
    case 'expired':
    case 'not-yet-valid':
    case 'validation-failed':
      return value;
    default:
      return null;
  }
}

const domainCoreColumns = {
  id: domains.id,
  projectId: domains.projectId,
  deploymentId: domains.deploymentId,
  host: domains.host,
  targetPort: domains.targetPort,
  verificationToken: domains.verificationToken,
  verificationStatus: domains.verificationStatus,
  verificationDetail: domains.verificationDetail,
  verificationCheckedAt: domains.verificationCheckedAt,
  verificationStatusChangedAt: domains.verificationStatusChangedAt,
  verificationVerifiedAt: domains.verificationVerifiedAt,
  ownershipStatus: domains.ownershipStatus,
  ownershipDetail: domains.ownershipDetail,
  tlsStatus: domains.tlsStatus,
  tlsDetail: domains.tlsDetail,
  certificateValidFrom: domains.certificateValidFrom,
  certificateValidTo: domains.certificateValidTo,
  certificateSubjectName: domains.certificateSubjectName,
  certificateIssuerName: domains.certificateIssuerName,
  certificateSubjectAltNames: domains.certificateSubjectAltNames,
  certificateChainSubjects: domains.certificateChainSubjects,
  certificateChainEntries: domains.certificateChainEntries,
  certificateRootSubjectName: domains.certificateRootSubjectName,
  certificateChainChangedAt: domains.certificateChainChangedAt,
  certificateChainObservedCount: domains.certificateChainObservedCount,
  certificateChainLastHealthyAt: domains.certificateChainLastHealthyAt,
  certificateLastHealthyChainEntries: domains.certificateLastHealthyChainEntries,
  certificatePathValidityChangedAt: domains.certificatePathValidityChangedAt,
  certificatePathValidityObservedCount: domains.certificatePathValidityObservedCount,
  certificatePathValidityLastHealthyAt: domains.certificatePathValidityLastHealthyAt,
  certificateValidationReason: domains.certificateValidationReason,
  certificateFingerprintSha256: domains.certificateFingerprintSha256,
  certificateSerialNumber: domains.certificateSerialNumber,
  certificateFirstObservedAt: domains.certificateFirstObservedAt,
  certificateChangedAt: domains.certificateChangedAt,
  certificateLastRotatedAt: domains.certificateLastRotatedAt,
  certificateGuidanceChangedAt: domains.certificateGuidanceChangedAt,
  certificateGuidanceObservedCount: domains.certificateGuidanceObservedCount,
  diagnosticsCheckedAt: domains.diagnosticsCheckedAt,
  ownershipStatusChangedAt: domains.ownershipStatusChangedAt,
  tlsStatusChangedAt: domains.tlsStatusChangedAt,
  ownershipVerifiedAt: domains.ownershipVerifiedAt,
  tlsReadyAt: domains.tlsReadyAt,
  createdAt: domains.createdAt,
  updatedAt: domains.updatedAt
} as const;

function toDomainRecordWithDeployment(record: {
  id: string;
  projectId: string;
  deploymentId: string | null;
  host: string;
  targetPort: number;
  verificationToken: string | null;
  verificationStatus: ProjectDomainVerificationStatus | null;
  verificationDetail: string | null;
  verificationCheckedAt: Date | null;
  verificationStatusChangedAt: Date | null;
  verificationVerifiedAt: Date | null;
  ownershipStatus: ProjectDomainOwnershipStatus | null;
  ownershipDetail: string | null;
  tlsStatus: ProjectDomainTlsStatus | null;
  tlsDetail: string | null;
  certificateValidFrom: Date | null;
  certificateValidTo: Date | null;
  certificateSubjectName: string | null;
  certificateIssuerName: string | null;
  certificateSubjectAltNames: string[];
  certificateChainSubjects: string[];
  certificateChainEntries: ProjectDomainCertificateChainEntry[];
  certificateRootSubjectName: string | null;
  certificateChainChangedAt: Date | null;
  certificateChainObservedCount: number;
  certificateChainLastHealthyAt: Date | null;
  certificateLastHealthyChainEntries: ProjectDomainCertificateChainEntry[];
  certificatePathValidityChangedAt: Date | null;
  certificatePathValidityObservedCount: number;
  certificatePathValidityLastHealthyAt: Date | null;
  certificateValidationReason: string | null;
  certificateFingerprintSha256: string | null;
  certificateSerialNumber: string | null;
  certificateFirstObservedAt: Date | null;
  certificateChangedAt: Date | null;
  certificateLastRotatedAt: Date | null;
  certificateGuidanceChangedAt: Date | null;
  certificateGuidanceObservedCount: number;
  diagnosticsCheckedAt: Date | null;
  ownershipStatusChangedAt: Date | null;
  tlsStatusChangedAt: Date | null;
  ownershipVerifiedAt: Date | null;
  tlsReadyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deploymentStatus: string | null;
  runtimeUrl: string | null;
  serviceName: string | null;
  deploymentMetadata: unknown;
}): ProjectDomainRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    deploymentId: record.deploymentId,
    host: record.host,
    targetPort: record.targetPort,
    verificationToken: record.verificationToken,
    verificationStatus: record.verificationStatus,
    verificationDetail: record.verificationDetail,
    verificationCheckedAt: record.verificationCheckedAt,
    verificationStatusChangedAt: record.verificationStatusChangedAt,
    verificationVerifiedAt: record.verificationVerifiedAt,
    ownershipStatus: record.ownershipStatus,
    ownershipDetail: record.ownershipDetail,
    tlsStatus: record.tlsStatus,
    tlsDetail: record.tlsDetail,
    certificateValidFrom: record.certificateValidFrom,
    certificateValidTo: record.certificateValidTo,
    certificateSubjectName: record.certificateSubjectName,
    certificateIssuerName: record.certificateIssuerName,
    certificateSubjectAltNames: record.certificateSubjectAltNames,
    certificateChainSubjects: record.certificateChainSubjects,
    certificateChainEntries: record.certificateChainEntries,
    certificateRootSubjectName: record.certificateRootSubjectName,
    certificateChainChangedAt: record.certificateChainChangedAt,
    certificateChainObservedCount: record.certificateChainObservedCount,
    certificateChainLastHealthyAt: record.certificateChainLastHealthyAt,
    certificateLastHealthyChainEntries: record.certificateLastHealthyChainEntries,
    certificatePathValidityChangedAt: record.certificatePathValidityChangedAt,
    certificatePathValidityObservedCount: record.certificatePathValidityObservedCount,
    certificatePathValidityLastHealthyAt: record.certificatePathValidityLastHealthyAt,
    certificateValidationReason: toCertificateValidationReason(record.certificateValidationReason),
    certificateFingerprintSha256: record.certificateFingerprintSha256,
    certificateSerialNumber: record.certificateSerialNumber,
    certificateFirstObservedAt: record.certificateFirstObservedAt,
    certificateChangedAt: record.certificateChangedAt,
    certificateLastRotatedAt: record.certificateLastRotatedAt,
    certificateGuidanceChangedAt: record.certificateGuidanceChangedAt,
    certificateGuidanceObservedCount: record.certificateGuidanceObservedCount,
    diagnosticsCheckedAt: record.diagnosticsCheckedAt,
    ownershipStatusChangedAt: record.ownershipStatusChangedAt,
    tlsStatusChangedAt: record.tlsStatusChangedAt,
    ownershipVerifiedAt: record.ownershipVerifiedAt,
    tlsReadyAt: record.tlsReadyAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deploymentStatus: record.deploymentStatus as ProjectDomainRecord['deploymentStatus'],
    runtimeUrl: record.runtimeUrl,
    ...toDeploymentServiceMetadata({
      serviceName: record.serviceName,
      metadata: record.deploymentMetadata
    })
  };
}

export class ProjectDomainsRepository {
  constructor(private readonly db: DbClient) {}

  async listDomains(projectId: string): Promise<ProjectDomainRecord[]> {
    const records = await this.db
      .select({
        ...domainCoreColumns,
        deploymentStatus: deployments.status,
        runtimeUrl: deployments.runtimeUrl,
        serviceName: deployments.serviceName,
        deploymentMetadata: deployments.metadata
      })
      .from(domains)
      .leftJoin(deployments, eq(deployments.id, domains.deploymentId))
      .where(eq(domains.projectId, projectId))
      .orderBy(asc(domains.host), desc(domains.updatedAt));

    return records.map(toDomainRecordWithDeployment);
  }

  async createDomain(input: CreateProjectDomainInput): Promise<ProjectDomainRecord> {
    const [record] = await this.db
      .insert(domains)
      .values({
        projectId: input.projectId,
        host: input.host,
        targetPort: input.targetPort,
        verificationToken: input.verificationToken,
        deploymentId: null
      })
      .returning();

    return {
      id: record.id,
      projectId: record.projectId,
      deploymentId: record.deploymentId,
      host: record.host,
      targetPort: record.targetPort,
      verificationToken: record.verificationToken,
      verificationStatus: record.verificationStatus,
      verificationDetail: record.verificationDetail,
      verificationCheckedAt: record.verificationCheckedAt,
      verificationStatusChangedAt: record.verificationStatusChangedAt,
      verificationVerifiedAt: record.verificationVerifiedAt,
      ownershipStatus: record.ownershipStatus,
      ownershipDetail: record.ownershipDetail,
      tlsStatus: record.tlsStatus,
      tlsDetail: record.tlsDetail,
      certificateValidFrom: record.certificateValidFrom,
      certificateValidTo: record.certificateValidTo,
      certificateSubjectName: record.certificateSubjectName,
      certificateIssuerName: record.certificateIssuerName,
      certificateSubjectAltNames: record.certificateSubjectAltNames,
      certificateChainSubjects: record.certificateChainSubjects,
      certificateChainEntries: record.certificateChainEntries,
      certificateRootSubjectName: record.certificateRootSubjectName,
      certificateChainChangedAt: record.certificateChainChangedAt,
      certificateChainObservedCount: record.certificateChainObservedCount,
      certificateChainLastHealthyAt: record.certificateChainLastHealthyAt,
      certificateLastHealthyChainEntries: record.certificateLastHealthyChainEntries,
      certificatePathValidityChangedAt: record.certificatePathValidityChangedAt,
      certificatePathValidityObservedCount: record.certificatePathValidityObservedCount,
      certificatePathValidityLastHealthyAt: record.certificatePathValidityLastHealthyAt,
      certificateValidationReason: toCertificateValidationReason(record.certificateValidationReason),
      certificateFingerprintSha256: record.certificateFingerprintSha256,
      certificateSerialNumber: record.certificateSerialNumber,
      certificateFirstObservedAt: record.certificateFirstObservedAt,
      certificateChangedAt: record.certificateChangedAt,
      certificateLastRotatedAt: record.certificateLastRotatedAt,
      certificateGuidanceChangedAt: record.certificateGuidanceChangedAt,
      certificateGuidanceObservedCount: record.certificateGuidanceObservedCount,
      diagnosticsCheckedAt: record.diagnosticsCheckedAt,
      ownershipStatusChangedAt: record.ownershipStatusChangedAt,
      tlsStatusChangedAt: record.tlsStatusChangedAt,
      ownershipVerifiedAt: record.ownershipVerifiedAt,
      tlsReadyAt: record.tlsReadyAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: null,
      serviceKind: null,
      serviceExposure: null
    } satisfies ProjectDomainRecord;
  }

  async findDomainById(projectId: string, domainId: string): Promise<ProjectDomainRecord | null> {
    const records = await this.db
      .select({
        ...domainCoreColumns,
        deploymentStatus: deployments.status,
        runtimeUrl: deployments.runtimeUrl,
        serviceName: deployments.serviceName,
        deploymentMetadata: deployments.metadata
      })
      .from(domains)
      .leftJoin(deployments, eq(deployments.id, domains.deploymentId))
      .where(and(
        eq(domains.projectId, projectId),
        eq(domains.id, domainId)
      ))
      .limit(1);

    const record = records[0];
    if (!record) {
      return null;
    }

    return toDomainRecordWithDeployment(record);
  }

  async removeDomain(projectId: string, domainId: string) {
    const rows = await this.db
      .delete(domains)
      .where(and(
        eq(domains.projectId, projectId),
        eq(domains.id, domainId)
      ))
      .returning({ id: domains.id });

    return rows[0] ?? null;
  }

  async updateDomainDiagnostics(input: UpdateProjectDomainDiagnosticsInput) {
    const [record] = await this.db
      .update(domains)
      .set({
        verificationStatus: input.verificationStatus,
        verificationDetail: input.verificationDetail,
        verificationCheckedAt: input.verificationCheckedAt,
        verificationStatusChangedAt: input.verificationStatusChangedAt,
        verificationVerifiedAt: input.verificationVerifiedAt,
        ownershipStatus: input.ownershipStatus,
        ownershipDetail: input.ownershipDetail,
        tlsStatus: input.tlsStatus,
        tlsDetail: input.tlsDetail,
        certificateValidFrom: input.certificateValidFrom,
        certificateValidTo: input.certificateValidTo,
        certificateSubjectName: input.certificateSubjectName,
        certificateIssuerName: input.certificateIssuerName,
        certificateSubjectAltNames: input.certificateSubjectAltNames,
        certificateChainSubjects: input.certificateChainSubjects,
        certificateChainEntries: input.certificateChainEntries,
        certificateRootSubjectName: input.certificateRootSubjectName,
        certificateChainChangedAt: input.certificateChainChangedAt,
        certificateChainObservedCount: input.certificateChainObservedCount,
        certificateChainLastHealthyAt: input.certificateChainLastHealthyAt,
        certificateLastHealthyChainEntries: input.certificateLastHealthyChainEntries,
        certificatePathValidityChangedAt: input.certificatePathValidityChangedAt,
        certificatePathValidityObservedCount: input.certificatePathValidityObservedCount,
        certificatePathValidityLastHealthyAt: input.certificatePathValidityLastHealthyAt,
        certificateValidationReason: input.certificateValidationReason,
        certificateFingerprintSha256: input.certificateFingerprintSha256,
        certificateSerialNumber: input.certificateSerialNumber,
        certificateFirstObservedAt: input.certificateFirstObservedAt,
        certificateChangedAt: input.certificateChangedAt,
        certificateLastRotatedAt: input.certificateLastRotatedAt,
        certificateGuidanceChangedAt: input.certificateGuidanceChangedAt,
        certificateGuidanceObservedCount: input.certificateGuidanceObservedCount,
        diagnosticsCheckedAt: input.diagnosticsCheckedAt,
        ownershipStatusChangedAt: input.ownershipStatusChangedAt,
        tlsStatusChangedAt: input.tlsStatusChangedAt,
        ownershipVerifiedAt: input.ownershipVerifiedAt,
        tlsReadyAt: input.tlsReadyAt
      })
      .where(and(
        eq(domains.projectId, input.projectId),
        eq(domains.id, input.domainId)
      ))
      .returning({ id: domains.id });

    return record ?? null;
  }

  async addDomainEvents(input: CreateProjectDomainEventInput[]) {
    if (input.length === 0) {
      return [];
    }

    return this.db
      .insert(projectDomainEvents)
      .values(input.map((event) => ({
        projectId: event.projectId,
        domainId: event.domainId,
        kind: event.kind,
        previousStatus: event.previousStatus,
        nextStatus: event.nextStatus,
        detail: event.detail,
        createdAt: event.createdAt
      })))
      .returning({ id: projectDomainEvents.id });
  }

  async listRecentDomainEvents(input: {
    projectId: string;
    limitPerDomain?: number;
    kinds?: readonly ProjectDomainEventKind[];
  }): Promise<ProjectDomainEventRecord[]> {
    const kindFilter = input.kinds && input.kinds.length > 0
      ? sql` and ${projectDomainEvents.kind} in (${sql.join(
        input.kinds.map((kind) => sql`${kind}`),
        sql`, `
      )})`
      : sql``;

    if (!input.limitPerDomain) {
      const result = await this.db.execute(sql<{
        id: string;
        project_id: string;
        domain_id: string;
        kind: ProjectDomainEventKind;
        previous_status: string | null;
        next_status: string;
        detail: string;
        created_at: Date;
      }>`
        select
          ${projectDomainEvents.id} as id,
          ${projectDomainEvents.projectId} as project_id,
          ${projectDomainEvents.domainId} as domain_id,
          ${projectDomainEvents.kind} as kind,
          ${projectDomainEvents.previousStatus} as previous_status,
          ${projectDomainEvents.nextStatus} as next_status,
          ${projectDomainEvents.detail} as detail,
          ${projectDomainEvents.createdAt} as created_at
        from ${projectDomainEvents}
        where ${projectDomainEvents.projectId} = ${input.projectId}${kindFilter}
        order by ${projectDomainEvents.domainId} asc, ${projectDomainEvents.createdAt} desc
      `);

      return result.rows.map((row: {
        id: string;
        project_id: string;
        domain_id: string;
        kind: ProjectDomainEventKind;
        previous_status: string | null;
        next_status: string;
        detail: string;
        created_at: Date;
      }) => ({
        id: row.id,
        projectId: row.project_id,
        domainId: row.domain_id,
        kind: row.kind,
        previousStatus: row.previous_status,
        nextStatus: row.next_status,
        detail: row.detail,
        createdAt: row.created_at
      })) satisfies ProjectDomainEventRecord[];
    }

    const result = await this.db.execute(sql<{
      id: string;
      project_id: string;
      domain_id: string;
      kind: ProjectDomainEventKind;
      previous_status: string | null;
      next_status: string;
      detail: string;
      created_at: Date;
    }>`
      select id, project_id, domain_id, kind, previous_status, next_status, detail, created_at
      from (
        select
          ${projectDomainEvents.id} as id,
          ${projectDomainEvents.projectId} as project_id,
          ${projectDomainEvents.domainId} as domain_id,
          ${projectDomainEvents.kind} as kind,
          ${projectDomainEvents.previousStatus} as previous_status,
          ${projectDomainEvents.nextStatus} as next_status,
          ${projectDomainEvents.detail} as detail,
          ${projectDomainEvents.createdAt} as created_at,
          row_number() over (
            partition by ${projectDomainEvents.domainId}
            order by ${projectDomainEvents.createdAt} desc
          ) as row_num
        from ${projectDomainEvents}
        where ${projectDomainEvents.projectId} = ${input.projectId}${kindFilter}
      ) recent_domain_events
      where row_num <= ${input.limitPerDomain}
      order by domain_id asc, created_at desc
    `);

    return result.rows.map((row: {
      id: string;
      project_id: string;
      domain_id: string;
      kind: ProjectDomainEventKind;
      previous_status: string | null;
      next_status: string;
      detail: string;
      created_at: Date;
    }) => ({
      id: row.id,
      projectId: row.project_id,
      domainId: row.domain_id,
      kind: row.kind,
      previousStatus: row.previous_status,
      nextStatus: row.next_status,
      detail: row.detail,
      createdAt: row.created_at
    })) satisfies ProjectDomainEventRecord[];
  }

  async listProjectIdsForDomainDiagnosticsRefresh(input: {
    staleBefore: Date;
    limit: number;
  }) {
    const result = await this.db.execute(sql<{ project_id: string }>`
      select project_id
      from ${domains}
      where diagnostics_checked_at is null
         or diagnostics_checked_at < ${input.staleBefore}
      group by project_id
      order by min(coalesce(diagnostics_checked_at, created_at)) asc
      limit ${input.limit}
    `);

    return result.rows.map((row: { project_id: string }) => row.project_id);
  }
}
