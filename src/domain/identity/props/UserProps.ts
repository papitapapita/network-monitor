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
  createdAt: Date;
  updatedAt: Date;
}
