import { QuotationId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';

export interface QuotationCreatedEventProps {
  readonly aggregateId: QuotationId;
  readonly customerName: string;
  readonly total: Money;
  readonly dateTimeOccurred: Date;
}
