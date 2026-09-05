import { DomainEvent } from 'domain/shared/core';
import { QuotationId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { QuotationCreatedEventProps } from '../props';

export class QuotationCreatedEvent extends DomainEvent<QuotationCreatedEventProps> {
  get aggregateId(): QuotationId {
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
