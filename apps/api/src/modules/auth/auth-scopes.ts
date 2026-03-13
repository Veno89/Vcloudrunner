export const ALL_TOKEN_SCOPES = [
  'projects:read',
  'projects:write',
  'deployments:read',
  'deployments:write',
  'deployments:cancel',
  'environment:read',
  'environment:write',
  'logs:read',
  'tokens:read',
  'tokens:write'
] as const;

export type TokenScope = (typeof ALL_TOKEN_SCOPES)[number] | '*';

export const DEFAULT_USER_TOKEN_SCOPES: TokenScope[] = [...ALL_TOKEN_SCOPES];

export function normalizeTokenScopes(input: unknown, role: 'admin' | 'user'): TokenScope[] {
  if (Array.isArray(input) && input.length > 0) {
    const normalized = input
      .filter((value): value is string => typeof value === 'string')
      .filter((value): value is TokenScope => value === '*' || ALL_TOKEN_SCOPES.includes(value as (typeof ALL_TOKEN_SCOPES)[number]));

    if (normalized.length > 0) {
      return Array.from(new Set(normalized));
    }
  }

  return role === 'admin' ? ['*'] : [...DEFAULT_USER_TOKEN_SCOPES];
}

export function hasScope(scopes: readonly TokenScope[], required: TokenScope): boolean {
  return scopes.includes('*') || scopes.includes(required);
}