import { QuotationId } from 'domain/shared/ids';

export interface QuotationRejectedEventProps {
  readonly aggregateId: QuotationId;
  readonly reason: string;
  readonly rejectedAt: Date;
  readonly dateTimeOccurred: Date;
}
