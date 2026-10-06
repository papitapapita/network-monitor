import { BillId, CustomerId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { Bill } from '../aggregates';
import { BillStatus } from '../enums';
import { BillingPeriod } from '../value-objects';

export interface BillFilters {
  customerId?: CustomerId;
  status?: BillStatus;
  period?: BillingPeriod;
}

export interface IBillRepository {
  save(bill: Bill): Promise<Result<Bill>>;
  findById(id: BillId): Promise<Result<Bill | null>>;
  findByCustomerId(
    customerId: CustomerId,
    limit?: number,
    offset?: number
  ): Promise<Result<Bill[]>>;
  findAll(
    filters?: BillFilters,
    limit?: number,
    offset?: number
  ): Promise<Result<Bill[]>>;
  count(filters?: BillFilters): Promise<Result<number>>;
  existsForCustomerAndPeriod(
    customerId: CustomerId,
    period: BillingPeriod
  ): Promise<Result<boolean>>;
  exists(id: BillId): Promise<Result<boolean>>;
  // Every PENDING bill whose due date is before `instant`, unpaged.
  findPendingDueBefore(instant: Date): Promise<Result<Bill[]>>;
  // Every OVERDUE bill due between `from` and `to`, both included, unpaged.
  findOverdueDueBetween(
    from: Date,
    to: Date
  ): Promise<Result<Bill[]>>;
  // Each customer, once, holding an OVERDUE bill due before `instant`.
  findCustomersOverdueBefore(
    instant: Date
  ): Promise<Result<CustomerId[]>>;
}
