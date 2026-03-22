import { createHash, createHmac, createSign } from 'node:crypto';

export function sha256Hex(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(key: Uint8Array | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

export function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function normalizePrivateKey(raw: string) {
  return raw.replace(/\\n/g, '\n');
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function joinObjectKey(prefix: string, fileName: string) {
  const cleanedPrefix = prefix.trim().replace(/^\/+|\/+$/g, '');
  return cleanedPrefix.length > 0 ? `${cleanedPrefix}/${fileName}` : fileName;
}

export function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

export function encodeObjectKey(key: string) {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function signJwtAssertion(input: { unsignedToken: string; privateKey: string }) {
  const signer = createSign('RSA-SHA256');
  signer.update(input.unsignedToken);
  signer.end();
  return signer.sign(input.privateKey).toString('base64url');
}
