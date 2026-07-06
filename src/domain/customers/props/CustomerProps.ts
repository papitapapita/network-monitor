import { PhoneNumber, Cedula, EmailAddress } from '../value-objects';

export interface CustomerProps {
  fullName: string;
  phone: PhoneNumber;
  email: EmailAddress | null;
  cedula: Cedula | null;
  createdAt: Date;
  updatedAt: Date;
}
