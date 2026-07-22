import { BillId } from 'domain/shared/ids';

export interface BillCancelledEventProps {
  readonly aggregateId: BillId;
  readonly dateTimeOccurred: Date;
}
