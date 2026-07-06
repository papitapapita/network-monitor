import { UserEmail } from '../value-objects/UserEmail';
import { UserRole } from '../value-objects/UserRole';

export interface UserProps {
  email: UserEmail;
  role: UserRole;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
