import { DomainEvent } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';
import { BillPaidEventProps } from '../props';

export class BillPaidEvent extends DomainEvent<BillPaidEventProps> {
  get aggregateId(): BillId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get paidAt(): Date {
    return this.props.paidAt;
  }
}
