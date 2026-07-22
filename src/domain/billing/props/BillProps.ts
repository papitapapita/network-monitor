import { CustomerId } from 'domain/shared/ids';
import { BillStatus } from '../enums';
import { BillingPeriod, BillLineItem } from '../value-objects';

export interface BillProps {
  customerId: CustomerId;
  period: BillingPeriod;
  status: BillStatus;
  lineItems: BillLineItem[];
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
