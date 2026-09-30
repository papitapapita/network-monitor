import { UserEmail } from '../value-objects/UserEmail';
import { UserRole } from '../value-objects/UserRole';

export interface UserProps {
  email: UserEmail;
  role: UserRole;
  passwordHash: string;
  disabledAt: Date | null;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
