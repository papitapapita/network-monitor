import { QuotationId } from 'domain/shared/ids';

export interface QuotationExpiredEventProps {
  readonly aggregateId: QuotationId;
  readonly expiredAt: Date;
  readonly dateTimeOccurred: Date;
}
