import { createHash } from 'node:crypto';

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getTokenLast4(token: string): string {
  return token.slice(-4).padStart(4, '0');
}

export function buildTokenPreview(last4: string | null | undefined): string {
  if (!last4) {
    return '****';
  }

  return `****...${last4}`;
}
