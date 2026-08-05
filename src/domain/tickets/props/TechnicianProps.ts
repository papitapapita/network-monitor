import { UserId } from 'domain/shared/ids';
import { ContactPhone } from '../value-objects';

export interface TechnicianProps {
  fullName: string;
  phone: ContactPhone;
  email: string | null;
  userId: UserId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
