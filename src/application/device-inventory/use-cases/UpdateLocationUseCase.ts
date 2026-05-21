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

/**
 * UpdateLocationUseCase
 *
 * Business Intent: Apply a partial update (PATCH semantics) to an existing location.
 * Only fields that are explicitly provided in the request are changed; all omitted
 * fields are left unchanged.
 *
 * Flow:
 * 1. beforeExecute: Validate that id is non-empty, that type (when provided) is a
 *    known LocationType value, and that latitude/longitude are supplied together
 *    when either one is present. These are boundary-level rejections that do not
 *    require loading the aggregate.
 * 2. executeImpl:
 *    a. Parse LocationId and load the location — return failure if not found.
 *    b. Apply name change via location.updateName() when name is provided.
 *    c. Apply type change via location.updateType() when type is provided.
 *    d. Apply address field changes via location.updateAddressFields() when any
 *       address field (municipality, neighborhood, address) is provided.
 *    e. Apply coordinate change via location.updateCoordinates() when latitude and
 *       longitude are both provided (null clears coordinates).
 *    f. Persist via ILocationRepository and return a LocationResponseDTO.
 *
 * Business Rules:
 * - id is required.
 * - name, when provided, must be 1–150 characters (enforced by domain).
 * - type, when provided, must be a valid LocationType enum value.
 * - latitude and longitude must be supplied together; providing only one is rejected.
 * - Passing both latitude and longitude as null clears the stored coordinates.
 * - Domain events (LocationUpdatedEvent) are dispatched by the repository after the
 *   aggregate is persisted.
 *
 * Dependencies:
 * - ILocationRepository: Load and persist the Location aggregate.
 * - ILogger: Structured logging via the base UseCase template.
 *
 * @example
 * ```typescript
 * const useCase = new UpdateLocationUseCase(locationRepository, logger);
 * const result = await useCase.execute({
 *   id: '550e8400-e29b-41d4-a716-446655440000',
 *   name: 'Tower Norte Revised',
 *   type: 'TOWER',
 *   latitude: -23.561684,
 *   longitude: -46.655981
 * });
 * ```
 */
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

  // ============================================================================
  // Pre-execution validation
  // ============================================================================

  /**
   * Validates the inbound DTO before any domain or I/O work begins.
   *
   * Checks performed here (not in executeImpl) because they are
   * boundary-level rejections that do not require loading the aggregate:
   * - id presence (required)
   * - type membership in the LocationType enum (when provided)
   * - coordinates coherence (both lat/lon must be present if either is given)
   *
   * The domain's own Guard clauses inside Location command methods provide a second
   * layer of defence for length constraints and null checks; both layers are
   * intentional (defence-in-depth).
   */
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

    return null; // Validation passed
  }

  // ============================================================================
  // Main execution
  // ============================================================================

  /**
   * Orchestrates the location update.
   *
   * Steps:
   * 1. Parse LocationId from request.id.
   * 2. Load the location from the repository — return failure if not found.
   * 3. Apply name change when name is provided.
   * 4. Apply type change when type is provided (string mapped to LocationType enum).
   * 5. Apply address field changes when any address field is provided.
   * 6. Apply coordinate change when latitude and longitude are both provided:
   *    - Both non-null: build Coordinates and call updateCoordinates(coords).
   *    - Both null: call updateCoordinates(null) to clear.
   * 7. Persist the updated aggregate and return a LocationResponseDTO.
   *
   * No domain logic lives here — all invariants are enforced inside the
   * Location aggregate and its value objects.
   */
  protected async executeImpl(
    request: UpdateLocationRequestDTO
  ): Promise<Result<LocationResponseDTO>> {
    // Parse LocationId UUID
    const locationIdResult = LocationId.parse(request.id.trim());
    if (locationIdResult.isFailure) {
      return this.fail(
        `Invalid location ID: ${locationIdResult.error}`
      );
    }

    // Load existing location
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

    // Persist — domain events are dispatched by the repository implementation
    const saveResult = await this.locationRepository.save(location);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist location: ${saveResult.error}`
      );
    }

    return this.ok(LocationMapper.toDTO(saveResult.value));
  }
}
