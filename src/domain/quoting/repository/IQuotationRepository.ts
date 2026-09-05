import { CustomerId, QuotationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { Quotation } from '../aggregates';
import { QuotationStatus } from '../enums';

export interface QuotationFilters {
  status?: QuotationStatus;
  customerId?: CustomerId;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface IQuotationRepository {
  save(quotation: Quotation): Promise<Result<Quotation>>;
  findById(id: QuotationId): Promise<Result<Quotation | null>>;
  findByCustomerId(
    customerId: CustomerId,
    limit?: number,
    offset?: number
  ): Promise<Result<Quotation[]>>;
  findAll(
    filters?: QuotationFilters,
    limit?: number,
    offset?: number
  ): Promise<Result<Quotation[]>>;
  count(filters?: QuotationFilters): Promise<Result<number>>;
  exists(id: QuotationId): Promise<Result<boolean>>;
}
