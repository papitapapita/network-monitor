import { EnsureVendorAccountRequestDTO } from 'application/identity';

// The account of the company that sells and runs this install. Unset means
// the install has none yet. VENDOR_PASSWORD is read only to create the account
// and can be removed once it exists; a password with no email to go with it is
// a mistake, so it stops the boot.
export function loadVendorAccount(
  env: NodeJS.ProcessEnv
): EnsureVendorAccountRequestDTO | null {
  const email = env.VENDOR_EMAIL?.trim();
  const password = env.VENDOR_PASSWORD || undefined;
  if (!email) {
    if (password) {
      throw new Error(
        'VENDOR_PASSWORD is set but VENDOR_EMAIL is not'
      );
    }
    return null;
  }
  return { email, password };
}
