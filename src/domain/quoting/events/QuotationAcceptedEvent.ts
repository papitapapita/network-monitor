import { DomainEvent } from 'domain/shared/core';
import { QuotationId } from 'domain/shared/ids';
import { QuotationAcceptedEventProps } from '../props';

export class QuotationAcceptedEvent extends DomainEvent<QuotationAcceptedEventProps> {
  get aggregateId(): QuotationId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get acceptedAt(): Date {
    return this.props.acceptedAt;
  }
}
