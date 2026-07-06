import { Location } from 'domain/device-inventory/aggregates';
import { ILocationRepository } from 'domain/device-inventory/repository';
import { LocationType } from 'domain/device-inventory/enums';
import { Address, Coordinates } from 'domain/device-inventory/value-objects';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { LocationMapper } from '../mappers';
import {
  CreateLocationRequestDTO,
  LocationResponseDTO
} from '../dtos';

export class CreateLocationUseCase extends UseCase<
  CreateLocationRequestDTO,
  LocationResponseDTO
> {
  constructor(
    private readonly locationRepository: ILocationRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateLocationUseCase');
  }

  protected async beforeExecute(
    request: CreateLocationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.name || request.name.trim().length === 0) {
      return Result.fail('Location name is required');
    }

    if (!request.type) {
      return Result.fail('Location type is required');
    }

    const upperType = request.type.toUpperCase();
    const validTypes = Object.values(LocationType) as string[];
    if (!validTypes.includes(upperType)) {
      return Result.fail(
        `Invalid location type: "${request.type}". Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Coordinates are optional, but lat and lon must come together
    const hasLatitude = request.latitude != null;
    const hasLongitude = request.longitude != null;
    if (hasLatitude !== hasLongitude) {
      return Result.fail(
        'Both latitude and longitude must be provided together'
      );
    }

    return null;
  }

  protected async executeImpl(
    request: CreateLocationRequestDTO
  ): Promise<Result<LocationResponseDTO>> {
    const data = LocationMapper.extractCreateData(request);

    const locationType = data.type.toUpperCase() as LocationType;

    let coordinates: Coordinates | null = null;
    if (data.latitude !== null && data.longitude !== null) {
      const coordResult = Coordinates.create({
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude ?? undefined
      });
      if (coordResult.isFailure) {
        return this.fail(`Invalid coordinates: ${coordResult.error}`);
      }
      coordinates = coordResult.value;
    }

    let address: Address | null = null;
    if (
      data.address !== null ||
      data.municipality !== null ||
      data.neighborhood !== null
    ) {
      if (
        data.address === null ||
        data.municipality === null ||
        data.neighborhood === null
      ) {
        return this.fail(
          'An address requires a street, municipality, and neighborhood'
        );
      }
      const addressResult = Address.create({
        street: data.address,
        municipality: data.municipality,
        neighborhood: data.neighborhood
      });
      if (addressResult.isFailure) {
        return this.fail(addressResult.error);
      }
      address = addressResult.value;
    }

    const now = new Date();

    const locationResult = Location.create({
      name: data.name.trim(),
      type: locationType,
      address,
      coordinates,
      createdAt: now,
      updatedAt: now
    });

    if (locationResult.isFailure) {
      return this.fail(locationResult.error!);
    }

    const location = locationResult.value;

    const saveResult = await this.locationRepository.save(location);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist location: ${saveResult.error}`
      );
    }

    return this.ok(LocationMapper.toDTO(saveResult.value));
  }
}
