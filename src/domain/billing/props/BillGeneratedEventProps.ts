import { BillId, CustomerId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { BillingPeriod } from '../value-objects';

export interface BillGeneratedEventProps {
  readonly aggregateId: BillId;
  readonly customerId: CustomerId;
  readonly period: BillingPeriod;
  readonly total: Money;
  readonly dateTimeOccurred: Date;
}
