// Reversible encryption for a secret the server must read back, such as a
// two-factor secret (IDN-162).
export interface ISecretCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
