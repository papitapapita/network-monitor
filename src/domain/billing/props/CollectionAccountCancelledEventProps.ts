import { CollectionAccountId } from 'domain/shared/ids';

export interface CollectionAccountCancelledEventProps {
  readonly aggregateId: CollectionAccountId;
  readonly cancelledAt: Date;
  readonly dateTimeOccurred: Date;
}
