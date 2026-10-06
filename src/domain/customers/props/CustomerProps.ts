import {
  PhoneNumber,
  Cedula,
  EmailAddress,
  PaymentDay
} from '../value-objects';

export interface CustomerProps {
  fullName: string;
  phone: PhoneNumber;
  email: EmailAddress | null;
  cedula: Cedula | null;
  paymentDay: PaymentDay;
  createdAt: Date;
  updatedAt: Date;
}
