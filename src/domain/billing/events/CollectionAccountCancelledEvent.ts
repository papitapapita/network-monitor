import { DomainEvent } from 'domain/shared/core';
import { CollectionAccountId } from 'domain/shared/ids';
import { CollectionAccountCancelledEventProps } from '../props';

export class CollectionAccountCancelledEvent extends DomainEvent<CollectionAccountCancelledEventProps> {
  get aggregateId(): CollectionAccountId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get cancelledAt(): Date {
    return this.props.cancelledAt;
  }
}
