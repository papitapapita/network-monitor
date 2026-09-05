import { DomainEvent } from 'domain/shared/core';
import { QuotationId } from 'domain/shared/ids';
import { QuotationRejectedEventProps } from '../props';

export class QuotationRejectedEvent extends DomainEvent<QuotationRejectedEventProps> {
  get aggregateId(): QuotationId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get reason(): string {
    return this.props.reason;
  }

  get rejectedAt(): Date {
    return this.props.rejectedAt;
  }
}
