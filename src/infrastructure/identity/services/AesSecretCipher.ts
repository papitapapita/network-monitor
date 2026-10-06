import { ISecretCipher } from 'application/identity/interfaces/ISecretCipher';
import { CredentialsEncryption } from '../../crypto/CredentialsEncryption';

// The install's existing AES-256-GCM key (DEVICE_CREDENTIALS_KEY): one key to
// back up and rotate rather than a second one for the same job.
export class AesSecretCipher implements ISecretCipher {
  public encrypt(plaintext: string): string {
    return CredentialsEncryption.encrypt(plaintext);
  }

  public decrypt(ciphertext: string): string {
    return CredentialsEncryption.decrypt(ciphertext);
  }
}
