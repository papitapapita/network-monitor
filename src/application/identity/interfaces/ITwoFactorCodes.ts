// Time-based one-time codes, as authenticator apps make them (IDN-161).
export interface ITwoFactorCodes {
  // A fresh shared secret, base32 as the apps expect it.
  generateSecret(): string;
  // What the setup QR code encodes; the app shows `issuer (account)`.
  provisioningUri(
    secret: string,
    account: string,
    issuer: string
  ): string;
  // The time step the code belongs to when it is valid at `now`, allowing
  // one step of clock drift either way; null when it is not.
  matchStep(secret: string, code: string, now: Date): number | null;
}
