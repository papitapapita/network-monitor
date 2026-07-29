import { ILocationRepository } from 'domain/device-inventory/repository';
import { LocationType } from 'domain/device-inventory/value-objects';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ListLocationsQueryDTO,
  LocationListResponseDTO
} from '../dtos';
import { LocationMapper } from '../mappers';

export class ListLocationsUseCase extends UseCase<
  ListLocationsQueryDTO,
  LocationListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly locationRepository: ILocationRepository,
    logger: ILogger
  ) {
    super(logger, 'ListLocationsUseCase');
  }

  protected async executeImpl(
    request: ListLocationsQueryDTO
  ): Promise<Result<LocationListResponseDTO>> {
    const limit = Math.min(
      request.limit ?? ListLocationsUseCase.DEFAULT_LIMIT,
      ListLocationsUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    if (request.type) {
      return this.listByType(request.type, limit, offset);
    }

    const locationsResult = await this.locationRepository.findAll(
      limit,
      offset
    );
    if (locationsResult.isFailure) {
      return this.fail<LocationListResponseDTO>(
        locationsResult.error!
      );
    }

    const countResult = await this.locationRepository.count();
    if (countResult.isFailure) {
      return this.fail<LocationListResponseDTO>(countResult.error!);
    }

    return this.ok<LocationListResponseDTO>(
      LocationMapper.toListDTO(
        locationsResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }

  // findByType does not accept pagination params — paginate in-memory
  private async listByType(
    typeStr: string,
    limit: number,
    offset: number
  ): Promise<Result<LocationListResponseDTO>> {
    const typeResult = LocationType.create(typeStr);
    if (typeResult.isFailure) {
      return this.fail<LocationListResponseDTO>(typeResult.error!);
    }

    const locationsResult = await this.locationRepository.findByType(
      typeResult.value
    );
    if (locationsResult.isFailure) {
      return this.fail<LocationListResponseDTO>(
        locationsResult.error!
      );
    }

    const allLocations = locationsResult.value;
    const paginatedLocations = allLocations.slice(
      offset,
      offset + limit
    );

    return this.ok<LocationListResponseDTO>(
      LocationMapper.toListDTO(
        paginatedLocations,
        allLocations.length,
        limit,
        offset
      )
    );
  }
}
