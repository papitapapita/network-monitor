import { DomainEvent } from 'domain/shared/core';
import { CollectionAccountId } from 'domain/shared/ids';
import { CollectionAccountPaidEventProps } from '../props';

export class CollectionAccountPaidEvent extends DomainEvent<CollectionAccountPaidEventProps> {
  get aggregateId(): CollectionAccountId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get paidAt(): Date {
    return this.props.paidAt;
  }
}
