import { QuotationId } from 'domain/shared/ids';

export interface QuotationAcceptedEventProps {
  readonly aggregateId: QuotationId;
  readonly acceptedAt: Date;
  readonly dateTimeOccurred: Date;
}
