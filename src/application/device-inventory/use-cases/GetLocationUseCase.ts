import { LocationId } from 'domain/shared/ids';
import { ILocationRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GetLocationRequestDTO, LocationResponseDTO } from '../dtos';
import { LocationMapper } from '../mappers';

export class GetLocationUseCase extends UseCase<
  GetLocationRequestDTO,
  LocationResponseDTO
> {
  constructor(
    private readonly locationRepository: ILocationRepository,
    logger: ILogger
  ) {
    super(logger, 'GetLocationUseCase');
  }

  protected async beforeExecute(
    request: GetLocationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Location ID is required');
    }

    return null;
  }

  protected async executeImpl(
    request: GetLocationRequestDTO
  ): Promise<Result<LocationResponseDTO>> {
    const locationIdResult = LocationId.parse(request.id.trim());
    if (locationIdResult.isFailure) {
      return this.fail<LocationResponseDTO>(
        `Invalid location ID: ${locationIdResult.error}`
      );
    }

    const findResult = await this.locationRepository.findById(
      locationIdResult.value
    );

    if (findResult.isFailure) {
      return this.fail<LocationResponseDTO>(findResult.error!);
    }

    const location = findResult.value;

    if (location === null) {
      return this.fail<LocationResponseDTO>(
        `Location not found: ${request.id}`
      );
    }

    return this.ok(LocationMapper.toDTO(location));
  }
}
