import { ILocationRepository } from 'domain/device-inventory/repository/ILocationRepository';
import { LocationType } from 'domain/device-inventory/enums/LocationType';
import { Coordinates } from 'domain/device-inventory/value-objects';
import { LocationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core/Result';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { UpdateLocationRequestDTO } from '../dtos/UpdateLocationRequestDTO';
import { LocationResponseDTO } from '../dtos/LocationResponseDTO';
import { LocationMapper } from '../mappers/LocationMapper';

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

    // Apply name change
    if (request.name !== undefined) {
      const updateNameResult = location.updateName(request.name);
      if (updateNameResult.isFailure) {
        return this.fail(updateNameResult.error!);
      }
    }

    // Apply type change — map string to domain enum (application-layer orchestration)
    if (request.type !== undefined) {
      const locationType = request.type.toUpperCase() as LocationType;
      const updateTypeResult = location.updateType(locationType);
      if (updateTypeResult.isFailure) {
        return this.fail(updateTypeResult.error!);
      }
    }

    // Apply address field changes when at least one address field is present
    const hasAddressField =
      request.municipality !== undefined ||
      request.neighborhood !== undefined ||
      request.address !== undefined;

    if (hasAddressField) {
      const addressFields: {
        municipality?: string | null;
        neighborhood?: string | null;
        address?: string | null;
      } = {};

      if (request.municipality !== undefined) {
        addressFields.municipality = request.municipality;
      }
      if (request.neighborhood !== undefined) {
        addressFields.neighborhood = request.neighborhood;
      }
      if (request.address !== undefined) {
        addressFields.address = request.address;
      }

      const updateAddressResult =
        location.updateAddressFields(addressFields);
      if (updateAddressResult.isFailure) {
        return this.fail(updateAddressResult.error!);
      }
    }

    // Apply coordinate change when both latitude and longitude are provided.
    // Both undefined  → coordinates not included in the request; skip entirely.
    // Both null       → explicit clear (passes null to updateCoordinates).
    // Both non-null   → build Coordinates VO and update.
    if (
      request.latitude !== undefined &&
      request.longitude !== undefined
    ) {
      if (request.latitude === null && request.longitude === null) {
        // Explicit clear
        const updateCoordsResult = location.updateCoordinates(null);
        if (updateCoordsResult.isFailure) {
          return this.fail(updateCoordsResult.error!);
        }
      } else if (
        request.latitude !== null &&
        request.longitude !== null
      ) {
        const coordResult = Coordinates.create({
          latitude: request.latitude,
          longitude: request.longitude,
          altitude: request.altitude ?? undefined
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
      // Mixed null/non-null is rejected in beforeExecute; no else branch needed.
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
