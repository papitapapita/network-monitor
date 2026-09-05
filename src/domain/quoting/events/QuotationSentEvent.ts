import { DomainEvent } from 'domain/shared/core';
import { QuotationId } from 'domain/shared/ids';
import { QuotationSentEventProps } from '../props';

export class QuotationSentEvent extends DomainEvent<QuotationSentEventProps> {
  get aggregateId(): QuotationId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get sentAt(): Date {
    return this.props.sentAt;
  }
}
