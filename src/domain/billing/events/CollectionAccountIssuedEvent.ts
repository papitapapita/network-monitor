import { DomainEvent } from 'domain/shared/core';
import { CollectionAccountId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { CollectionAccountIssuedEventProps } from '../props';

export class CollectionAccountIssuedEvent extends DomainEvent<CollectionAccountIssuedEventProps> {
  get aggregateId(): CollectionAccountId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get customerName(): string {
    return this.props.customerName;
  }

  get total(): Money {
    return this.props.total;
  }
}
