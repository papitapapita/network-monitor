import { UserEmail } from '../value-objects/UserEmail';
import { UserRole } from '../value-objects/UserRole';

export interface UserProps {
  email: UserEmail;
  role: UserRole;
  passwordHash: string;
  disabledAt: Date | null;
  tokenVersion: number;
  // Wrong passwords since the last successful sign-in (IDN-044).
  failedSignIns: number;
  signInPausedUntil: Date | null;
  // Two-factor sign-in (IDN-160…). The secret is stored encrypted and is
  // opaque here; it is set before `twoFactorEnabledAt` while setup awaits its
  // first code.
  twoFactorSecret: string | null;
  twoFactorEnabledAt: Date | null;
  // The last code's time step, so no code is accepted twice (IDN-164).
  twoFactorLastStep: number | null;
  recoveryCodeHashes: string[];
  createdAt: Date;
  updatedAt: Date;
}
