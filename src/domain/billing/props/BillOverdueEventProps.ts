import { BillId } from 'domain/shared/ids';

export interface BillOverdueEventProps {
  readonly aggregateId: BillId;
  readonly dateTimeOccurred: Date;
}
