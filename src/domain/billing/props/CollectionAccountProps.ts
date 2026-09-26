import { CustomerId, UserId } from 'domain/shared/ids';
import { CollectionAccountStatus } from '../enums';
import { CollectionAccountLineItem } from '../value-objects';

export interface CollectionAccountProps {
  // Assigned by the database sequence on first insert, so it is null only
  // between create() and the first save().
  code: number | null;
  status: CollectionAccountStatus;
  customerId: CustomerId | null;
  // Snapshotted at issue time, never re-read live: the document must keep
  // saying who it was addressed to, and walk-in customers have no record.
  customerName: string;
  customerDocument: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: CollectionAccountLineItem[];
  issueDate: Date;
  dueDate: Date | null;
  notes: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdBy: UserId | null;
  createdAt: Date;
  updatedAt: Date;
}
