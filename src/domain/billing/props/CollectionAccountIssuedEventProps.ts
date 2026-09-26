import { CollectionAccountId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';

export interface CollectionAccountIssuedEventProps {
  readonly aggregateId: CollectionAccountId;
  readonly customerName: string;
  readonly total: Money;
  readonly dateTimeOccurred: Date;
}
