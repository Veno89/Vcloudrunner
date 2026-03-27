import { env } from '../config/env.js';
import type { ProjectInvitationClaimRecord } from '../modules/projects/projects.repository.js';

const INVITATION_DELIVERY_TIMEOUT_MS = 10_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function buildProjectInvitationClaimUrl(claimToken: string) {
  return `${normalizeBaseUrl(env.INVITATION_CLAIM_BASE_URL)}/invitations/${claimToken}`;
}

export interface ProjectInvitationDeliveryResult {
  status: 'disabled' | 'delivered' | 'failed';
  message: string;
  claimUrl: string;
  attemptedAt: string;
}

export interface ProjectInvitationDeliveryInput {
  invitation: ProjectInvitationClaimRecord;
  trigger: 'created' | 'redelivered';
}

export interface ProjectInvitationDeliveryService {
  deliverInvitation(input: ProjectInvitationDeliveryInput): Promise<ProjectInvitationDeliveryResult>;
}

export class DisabledProjectInvitationDeliveryService implements ProjectInvitationDeliveryService {
  async deliverInvitation(input: ProjectInvitationDeliveryInput): Promise<ProjectInvitationDeliveryResult> {
    return {
      status: 'disabled',
      message: 'Invitation delivery automation is not configured.',
      claimUrl: buildProjectInvitationClaimUrl(input.invitation.claimToken),
      attemptedAt: new Date().toISOString()
    };
  }
}

export class WebhookProjectInvitationDeliveryService implements ProjectInvitationDeliveryService {
  async deliverInvitation(input: ProjectInvitationDeliveryInput): Promise<ProjectInvitationDeliveryResult> {
    const attemptedAt = new Date().toISOString();
    const claimUrl = buildProjectInvitationClaimUrl(input.invitation.claimToken);
    const webhookUrl = env.INVITATION_DELIVERY_WEBHOOK_URL.trim();

    if (webhookUrl.length === 0) {
      return {
        status: 'disabled',
        message: 'Invitation delivery automation is not configured.',
        claimUrl,
        attemptedAt
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, INVITATION_DELIVERY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(env.INVITATION_DELIVERY_WEBHOOK_AUTH_TOKEN.trim().length > 0
            ? { authorization: `Bearer ${env.INVITATION_DELIVERY_WEBHOOK_AUTH_TOKEN}` }
            : {})
        },
        body: JSON.stringify({
          source: 'api',
          event: 'project-invitation.pending',
          trigger: input.trigger,
          attemptedAt,
          claimUrl,
          project: {
            id: input.invitation.projectId,
            name: input.invitation.projectName,
            slug: input.invitation.projectSlug
          },
          invitation: {
            id: input.invitation.id,
            email: input.invitation.email,
            role: input.invitation.role,
            status: input.invitation.status,
            claimToken: input.invitation.claimToken,
            createdAt: input.invitation.createdAt,
            updatedAt: input.invitation.updatedAt
          },
          inviter: input.invitation.invitedByUser
        }),
        signal: controller.signal
      });
    } catch (error) {
      return {
        status: 'failed',
        message: controller.signal.aborted
          ? `Invitation delivery request timed out after ${INVITATION_DELIVERY_TIMEOUT_MS}ms.`
          : `Invitation delivery request failed: ${getErrorMessage(error)}`,
        claimUrl,
        attemptedAt
      };
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return {
        status: 'failed',
        message: `Invitation delivery webhook responded with status ${response.status}.`,
        claimUrl,
        attemptedAt
      };
    }

    return {
      status: 'delivered',
      message: 'Invitation delivery request completed successfully.',
      claimUrl,
      attemptedAt
    };
  }
}

export const disabledProjectInvitationDeliveryService =
  new DisabledProjectInvitationDeliveryService();
