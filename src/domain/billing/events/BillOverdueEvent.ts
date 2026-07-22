import { DomainEvent } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';
import { BillOverdueEventProps } from '../props';

export class BillOverdueEvent extends DomainEvent<BillOverdueEventProps> {
  get aggregateId(): BillId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
}
