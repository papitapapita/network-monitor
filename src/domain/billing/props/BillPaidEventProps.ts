import { BillId, CustomerId } from 'domain/shared/ids';

export interface BillPaidEventProps {
  readonly aggregateId: BillId;
  readonly customerId: CustomerId;
  readonly paidAt: Date;
  readonly dateTimeOccurred: Date;
}
