import { CollectionAccountId } from 'domain/shared/ids';

export interface CollectionAccountPaidEventProps {
  readonly aggregateId: CollectionAccountId;
  readonly paidAt: Date;
  readonly dateTimeOccurred: Date;
}
