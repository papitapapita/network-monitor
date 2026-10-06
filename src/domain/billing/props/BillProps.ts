import { CustomerId } from 'domain/shared/ids';
import { BillStatus } from '../enums';
import {
  BillingPeriod,
  BillLineItem,
  BillPayment
} from '../value-objects';

export interface BillProps {
  customerId: CustomerId;
  period: BillingPeriod;
  status: BillStatus;
  lineItems: BillLineItem[];
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  // How it was paid; absent on bills marked paid before payments were kept.
  payment?: BillPayment | null;
  createdAt: Date;
  updatedAt: Date;
}
