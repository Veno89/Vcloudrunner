import { fetchJson, postJson, deleteRequest } from './client';
import type { ApiDataResponse, ApiTokenRecord, CreatedApiTokenRecord } from './types';

interface CreateApiTokenInput {
  userId: string;
  role: 'admin' | 'user';
  scopes?: string[];
  label?: string;
  expiresAt?: string;
}

export async function fetchApiTokensForUser(userId: string): Promise<ApiTokenRecord[]> {
  const response = await fetchJson<ApiDataResponse<ApiTokenRecord[]>>(`/v1/users/${userId}/api-tokens`);

  return response.data;
}

export async function createApiToken(input: CreateApiTokenInput): Promise<CreatedApiTokenRecord> {
  const response = await postJson<ApiDataResponse<CreatedApiTokenRecord>>(`/v1/users/${input.userId}/api-tokens`, {
    role: input.role,
    ...(input.scopes && input.scopes.length > 0 ? { scopes: input.scopes } : {}),
    ...(input.label ? { label: input.label } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
  });

  return response.data;
}

export async function rotateApiToken(userId: string, tokenId: string): Promise<CreatedApiTokenRecord> {
  const response = await postJson<ApiDataResponse<CreatedApiTokenRecord>>(
    `/v1/users/${userId}/api-tokens/${tokenId}/rotate`,
    {}
  );

  return response.data;
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<void> {
  await deleteRequest(`/v1/users/${userId}/api-tokens/${tokenId}`);
}
