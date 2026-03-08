import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';

const deriveKey = () => createHash('sha256').update(env.ENCRYPTION_KEY).digest();

export class CryptoService {
  private readonly key = deriveKey();

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(cipherText: string): string {
    const [ivPart, authTagPart, encryptedPart] = cipherText.split(':');

    if (!ivPart || !authTagPart || !encryptedPart) {
      throw new Error('INVALID_CIPHERTEXT_FORMAT');
    }

    const iv = Buffer.from(ivPart, 'base64');
    const authTag = Buffer.from(authTagPart, 'base64');
    const encrypted = Buffer.from(encryptedPart, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
