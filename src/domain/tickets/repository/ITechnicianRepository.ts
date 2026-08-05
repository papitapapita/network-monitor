import { Result } from 'domain/shared/core';
import { TechnicianId } from 'domain/shared/ids';
import { Technician } from '../aggregates';

export interface ITechnicianRepository {
  save(technician: Technician): Promise<Result<Technician>>;
  findById(id: TechnicianId): Promise<Result<Technician | null>>;
  findByPhone(phone: string): Promise<Result<Technician | null>>;
  findAll(
    activeOnly?: boolean,
    limit?: number,
    offset?: number
  ): Promise<Result<Technician[]>>;
  delete(id: TechnicianId): Promise<Result<void>>;
  exists(id: TechnicianId): Promise<Result<boolean>>;
  existsByPhone(phone: string): Promise<Result<boolean>>;
  existsByEmail(email: string): Promise<Result<boolean>>;
  count(activeOnly?: boolean): Promise<Result<number>>;
}
