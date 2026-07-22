import { DomainEvent } from 'domain/shared/core';
import { BillId, CustomerId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { BillGeneratedEventProps } from '../props';
import { BillingPeriod } from '../value-objects';

export class BillGeneratedEvent extends DomainEvent<BillGeneratedEventProps> {
  get aggregateId(): BillId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get period(): BillingPeriod {
    return this.props.period;
  }

  get total(): Money {
    return this.props.total;
  }
}
