import { DomainEvent } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';
import { BillCancelledEventProps } from '../props';

export class BillCancelledEvent extends DomainEvent<BillCancelledEventProps> {
  get aggregateId(): BillId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
}
