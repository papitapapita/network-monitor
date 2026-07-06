import { ILocationRepository } from 'domain/device-inventory/repository';
import { LocationType } from 'domain/device-inventory/enums';
import { Coordinates } from 'domain/device-inventory/value-objects';
import { LocationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  UpdateLocationRequestDTO,
  LocationResponseDTO
} from '../dtos';
import { LocationMapper } from '../mappers';

export class UpdateLocationUseCase extends UseCase<
  UpdateLocationRequestDTO,
  LocationResponseDTO
> {
  constructor(
    private readonly locationRepository: ILocationRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateLocationUseCase');
  }

  protected async beforeExecute(
    request: UpdateLocationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Location ID is required');
    }

    if (request.type !== undefined) {
      const upperType = request.type.toUpperCase();
      const validTypes = Object.values(LocationType) as string[];
      if (!validTypes.includes(upperType)) {
        return Result.fail(
          `Invalid location type: "${request.type}". Must be one of: ${validTypes.join(', ')}`
        );
      }
    }

    // Coordinates are optional, but lat and lon must come together
    const hasLatitude = request.latitude !== undefined;
    const hasLongitude = request.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      return Result.fail(
        'Both latitude and longitude must be provided together'
      );
    }

    return null;
  }

  protected async executeImpl(
    request: UpdateLocationRequestDTO
  ): Promise<Result<LocationResponseDTO>> {
    const locationIdResult = LocationId.parse(request.id.trim());
    if (locationIdResult.isFailure) {
      return this.fail(
        `Invalid location ID: ${locationIdResult.error}`
      );
    }

    const findResult = await this.locationRepository.findById(
      locationIdResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Location not found: ${request.id}`);
    }

    const location = findResult.value;
    const data = LocationMapper.extractUpdateData(request);

    if (data.name !== undefined) {
      const updateNameResult = location.updateName(data.name);
      if (updateNameResult.isFailure) {
        return this.fail(updateNameResult.error!);
      }
    }

    if (data.type !== undefined) {
      const locationType = data.type.toUpperCase() as LocationType;
      const updateTypeResult = location.updateType(locationType);
      if (updateTypeResult.isFailure) {
        return this.fail(updateTypeResult.error!);
      }
    }

    const hasAddressField =
      data.municipality !== undefined ||
      data.neighborhood !== undefined ||
      data.address !== undefined;

    if (hasAddressField) {
      const addressFields: {
        municipality?: string | null;
        neighborhood?: string | null;
        address?: string | null;
      } = {};
      if (data.municipality !== undefined) {
        addressFields.municipality = data.municipality;
      }
      if (data.neighborhood !== undefined) {
        addressFields.neighborhood = data.neighborhood;
      }
      if (data.address !== undefined) {
        addressFields.address = data.address;
      }

      const updateAddressResult =
        location.updateAddressFields(addressFields);
      if (updateAddressResult.isFailure) {
        return this.fail(updateAddressResult.error!);
      }
    }

    // Both undefined → not sent, skip. Both null → explicit clear.
    // Both non-null → build VO. Mixed null/non-null rejected in beforeExecute.
    if (data.latitude !== undefined && data.longitude !== undefined) {
      if (data.latitude === null && data.longitude === null) {
        const updateCoordsResult = location.updateCoordinates(null);
        if (updateCoordsResult.isFailure) {
          return this.fail(updateCoordsResult.error!);
        }
      } else if (data.latitude !== null && data.longitude !== null) {
        const coordResult = Coordinates.create({
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude ?? undefined
        });
        if (coordResult.isFailure) {
          return this.fail(
            `Invalid coordinates: ${coordResult.error}`
          );
        }
        const updateCoordsResult = location.updateCoordinates(
          coordResult.value
        );
        if (updateCoordsResult.isFailure) {
          return this.fail(updateCoordsResult.error!);
        }
      }
    }

    const saveResult = await this.locationRepository.save(location);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist location: ${saveResult.error}`
      );
    }

    return this.ok(LocationMapper.toDTO(saveResult.value));
  }
}
