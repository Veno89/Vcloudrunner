import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { env } = await import('../config/env.js');
const {
  WebhookProjectInvitationDeliveryService,
  buildProjectInvitationClaimUrl
} = await import('./project-invitation-delivery.service.js');

async function withEnvOverrides(
  overrides: Partial<typeof env>,
  run: () => Promise<void>
) {
  const originalValues = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, env[key as keyof typeof env]])
  );

  Object.assign(env, overrides);

  try {
    await run();
  } finally {
    Object.assign(env, originalValues);
  }
}

const invitationRecord = {
  id: 'invite-1',
  projectId: 'project-1',
  projectName: 'Example Project',
  projectSlug: 'example-project',
  email: 'pending@example.com',
  claimToken: 'claim-token-123',
  role: 'editor' as const,
  status: 'pending' as const,
  invitedBy: 'owner-user',
  acceptedBy: null,
  createdAt: new Date('2026-03-26T00:00:00.000Z'),
  updatedAt: new Date('2026-03-26T00:00:00.000Z'),
  acceptedAt: null,
  cancelledAt: null,
  invitedByUser: {
    id: 'owner-user',
    name: 'Owner User',
    email: 'owner@example.com'
  },
  acceptedByUser: null
};

test('buildProjectInvitationClaimUrl uses the configured base URL without a trailing slash', async () => {
  await withEnvOverrides({
    INVITATION_CLAIM_BASE_URL: 'https://platform.example.com/'
  }, async () => {
    assert.equal(
      buildProjectInvitationClaimUrl('claim-token-123'),
      'https://platform.example.com/invitations/claim-token-123'
    );
  });
});

test('deliverInvitation returns disabled when no webhook URL is configured', async () => {
  await withEnvOverrides({
    INVITATION_CLAIM_BASE_URL: 'https://platform.example.com',
    INVITATION_DELIVERY_WEBHOOK_URL: '',
    INVITATION_DELIVERY_WEBHOOK_AUTH_TOKEN: ''
  }, async () => {
    const service = new WebhookProjectInvitationDeliveryService();
    const result = await service.deliverInvitation({
      invitation: invitationRecord,
      trigger: 'created'
    });

    assert.equal(result.status, 'disabled');
    assert.equal(result.claimUrl, 'https://platform.example.com/invitations/claim-token-123');
  });
});

test('deliverInvitation posts the invitation payload to the configured webhook', async (t) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  await withEnvOverrides({
    INVITATION_CLAIM_BASE_URL: 'https://platform.example.com',
    INVITATION_DELIVERY_WEBHOOK_URL: 'https://hooks.example.test/invitations',
    INVITATION_DELIVERY_WEBHOOK_AUTH_TOKEN: 'secret-token'
  }, async () => {
    t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    });

    const service = new WebhookProjectInvitationDeliveryService();
    const result = await service.deliverInvitation({
      invitation: invitationRecord,
      trigger: 'redelivered'
    });

    assert.equal(result.status, 'delivered');
  });

  assert.equal(calls[0]?.url, 'https://hooks.example.test/invitations');
  const headers = calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer secret-token');
  assert.equal(headers['content-type'], 'application/json');
  const payload = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(payload.event, 'project-invitation.pending');
  assert.equal(payload.trigger, 'redelivered');
  assert.equal(payload.claimUrl, 'https://platform.example.com/invitations/claim-token-123');
  assert.equal(payload.project.slug, 'example-project');
  assert.equal(payload.invitation.email, 'pending@example.com');
});

test('deliverInvitation returns failed when the webhook request errors', async (t) => {
  await withEnvOverrides({
    INVITATION_CLAIM_BASE_URL: 'https://platform.example.com',
    INVITATION_DELIVERY_WEBHOOK_URL: 'https://hooks.example.test/invitations',
    INVITATION_DELIVERY_WEBHOOK_AUTH_TOKEN: ''
  }, async () => {
    t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('socket hang up');
    });

    const service = new WebhookProjectInvitationDeliveryService();
    const result = await service.deliverInvitation({
      invitation: invitationRecord,
      trigger: 'created'
    });

    assert.equal(result.status, 'failed');
    assert.match(result.message, /socket hang up/);
  });
});
