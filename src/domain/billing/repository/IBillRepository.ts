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
}
