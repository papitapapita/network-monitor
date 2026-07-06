import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from 'crypto';

export class CredentialsEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;

  private static getKey(): Buffer {
    const keyHex = process.env.DEVICE_CREDENTIALS_KEY;
    if (!keyHex)
      throw new Error('DEVICE_CREDENTIALS_KEY env var is not set');
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== CredentialsEncryption.KEY_LENGTH)
      throw new Error(
        'DEVICE_CREDENTIALS_KEY must be 32 bytes (64 hex chars)'
      );
    return key;
  }

  static encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const key = CredentialsEncryption.getKey();
    const cipher = createCipheriv(
      CredentialsEncryption.ALGORITHM,
      key,
      iv
    );
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64')
    ].join(':');
  }

  static decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3)
      throw new Error('Invalid ciphertext format');
    const [ivB64, authTagB64, encB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encB64, 'base64');
    const key = CredentialsEncryption.getKey();
    const decipher = createDecipheriv(
      CredentialsEncryption.ALGORITHM,
      key,
      iv
    );
    decipher.setAuthTag(authTag);
    return (
      decipher.update(encrypted).toString('utf8') +
      decipher.final('utf8')
    );
  }
}
