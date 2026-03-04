import { Location } from '../aggregates';
import { LocationId } from '../../shared/ids';
import { LocationType } from '../enums';
import { Result } from '../../shared/core';

export interface ILocationRepository {
  save(location: Location): Promise<Result<Location>>;
  findById(id: LocationId): Promise<Result<Location | null>>;
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<Location[]>>;
  findByType(type: LocationType): Promise<Result<Location[]>>;
  delete(id: LocationId): Promise<Result<void>>;
  exists(id: LocationId): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
}
