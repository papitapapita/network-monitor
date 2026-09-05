import { CustomerId, UserId } from 'domain/shared/ids';
import { QuotationStatus } from '../enums';
import { QuotationLineItem } from '../value-objects';

export interface QuotationProps {
  // Assigned by the database sequence on first insert, so it is null only
  // between create() and the first save().
  code: number | null;
  status: QuotationStatus;
  customerId: CustomerId | null;
  // Snapshotted at creation time, never re-read live: a quotation is a
  // point-in-time offer, and Customer has no address field at all, so the
  // address can only ever come from this free-text snapshot.
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: QuotationLineItem[];
  validUntil: Date;
  notes: string | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  expiredAt: Date | null;
  createdBy: UserId | null;
  createdAt: Date;
  updatedAt: Date;
}
