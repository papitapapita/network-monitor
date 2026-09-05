import { DomainEvent } from 'domain/shared/core';
import { QuotationId } from 'domain/shared/ids';
import { QuotationExpiredEventProps } from '../props';

export class QuotationExpiredEvent extends DomainEvent<QuotationExpiredEventProps> {
  get aggregateId(): QuotationId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get expiredAt(): Date {
    return this.props.expiredAt;
  }
}
