import { QuotationId } from 'domain/shared/ids';

export interface QuotationSentEventProps {
  readonly aggregateId: QuotationId;
  readonly sentAt: Date;
  readonly dateTimeOccurred: Date;
}
