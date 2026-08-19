import { CustomerId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { Customer } from '../aggregates';

export interface ICustomerRepository {
  save(customer: Customer): Promise<Result<Customer>>;
  findById(id: CustomerId): Promise<Result<Customer | null>>;
  findByPhone(phone: string): Promise<Result<Customer | null>>;
  findByCedula(cedula: string): Promise<Result<Customer | null>>;
  findByEmail(email: string): Promise<Result<Customer | null>>;
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<Customer[]>>;
  delete(id: CustomerId): Promise<Result<void>>;
  exists(id: CustomerId): Promise<Result<boolean>>;
  existsByPhone(phone: string): Promise<Result<boolean>>;
  existsByCedula(cedula: string): Promise<Result<boolean>>;
  existsByEmail(email: string): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
}
