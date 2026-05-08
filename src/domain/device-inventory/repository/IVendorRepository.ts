import { VendorId } from '../../shared/ids';
import { Result } from '../../shared/core';
import { Vendor } from '../aggregates';

export interface IVendorRepository {
  save(vendor: Vendor): Promise<Result<Vendor>>;
  findById(id: VendorId): Promise<Result<Vendor | null>>;
  findBySlug(slug: string): Promise<Result<Vendor | null>>;
  findAll(limit?: number, offset?: number): Promise<Result<Vendor[]>>;
  delete(id: VendorId): Promise<Result<void>>;
  exists(id: VendorId): Promise<Result<boolean>>;
  existsBySlug(slug: string): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
}
