import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.DATASOURCE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('DATASOURCE_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)');
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypt plaintext → "iv:tag:ciphertext" (all hex) */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypt "iv:tag:ciphertext" (all hex) → plaintext */
export function decrypt(encoded: string): string {
  const key = getKey();
  const [ivHex, tagHex, cipherHex] = encoded.split(':');
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('Invalid encrypted format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
