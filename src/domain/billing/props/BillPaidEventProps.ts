import { BillId } from 'domain/shared/ids';

export interface BillPaidEventProps {
  readonly aggregateId: BillId;
  readonly paidAt: Date;
  readonly dateTimeOccurred: Date;
}
