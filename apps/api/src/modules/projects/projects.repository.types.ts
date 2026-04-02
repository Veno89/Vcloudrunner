import type {
  ProjectServiceDefinition,
  ProjectServiceExposure,
  ProjectServiceKind
} from '@vcloudrunner/shared-types';
import type {
  ProjectDomainCertificateChainEntry,
  ProjectDomainCertificateValidationReason,
  ProjectDomainVerificationStatus,
  ProjectDomainOwnershipStatus,
  ProjectDomainTlsStatus
} from '../../services/project-domain-diagnostics.service.js';

export type ProjectDomainEventKind =
  | 'ownership'
  | 'tls'
  | 'certificate'
  | 'certificate_trust'
  | 'certificate_path_validity'
  | 'certificate_identity'
  | 'certificate_attention'
  | 'certificate_chain';

export interface CreateProjectInput {
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch?: string;
  services?: ProjectServiceDefinition[];
}

export interface UpdateProjectInput {
  name?: string;
  gitRepositoryUrl?: string;
  defaultBranch?: string;
  services?: ProjectServiceDefinition[];
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  invitedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ProjectInvitationRecord {
  id: string;
  projectId: string;
  email: string;
  claimToken: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'cancelled';
  invitedBy: string | null;
  acceptedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  invitedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  acceptedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ProjectInvitationClaimRecord extends ProjectInvitationRecord {
  projectName: string;
  projectSlug: string;
}

export interface ProjectDomainRecord {
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
  certificateValidationReason: ProjectDomainCertificateValidationReason | null;
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
  deploymentStatus: 'queued' | 'building' | 'running' | 'failed' | 'stopped' | null;
  runtimeUrl: string | null;
  serviceName: string | null;
  serviceKind: ProjectServiceKind | null;
  serviceExposure: ProjectServiceExposure | null;
}

export interface ProjectDomainEventRecord {
  id: string;
  projectId: string;
  domainId: string;
  kind: ProjectDomainEventKind;
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: Date;
}

export interface ProjectActiveDeploymentRecord {
  id: string;
  projectId: string;
  serviceName: string;
  status: 'queued' | 'building' | 'running';
}

export interface CreateProjectDomainInput {
  projectId: string;
  host: string;
  targetPort: number;
  verificationToken: string | null;
}

export interface CreateProjectDomainEventInput {
  projectId: string;
  domainId: string;
  kind: ProjectDomainEventKind;
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: Date;
}

export interface UpdateProjectDomainDiagnosticsInput {
  projectId: string;
  domainId: string;
  verificationStatus: ProjectDomainVerificationStatus;
  verificationDetail: string;
  verificationCheckedAt: Date;
  verificationStatusChangedAt: Date | null;
  verificationVerifiedAt: Date | null;
  ownershipStatus: ProjectDomainOwnershipStatus;
  ownershipDetail: string;
  tlsStatus: ProjectDomainTlsStatus;
  tlsDetail: string;
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
  certificateValidationReason: ProjectDomainCertificateValidationReason | null;
  certificateFingerprintSha256: string | null;
  certificateSerialNumber: string | null;
  certificateFirstObservedAt: Date | null;
  certificateChangedAt: Date | null;
  certificateLastRotatedAt: Date | null;
  certificateGuidanceChangedAt: Date | null;
  certificateGuidanceObservedCount: number;
  diagnosticsCheckedAt: Date;
  ownershipStatusChangedAt: Date | null;
  tlsStatusChangedAt: Date | null;
  ownershipVerifiedAt: Date | null;
  tlsReadyAt: Date | null;
}
