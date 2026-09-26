import { BankAccountDetails } from '../value-objects';

export interface BankAccountProps {
  details: BankAccountDetails;
  createdAt: Date;
  updatedAt: Date;
}
