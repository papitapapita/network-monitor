import { Location } from '../../../domain/device-inventory/aggregates/Location';
import { ILocationRepository } from '../../../domain/device-inventory/repository/ILocationRepository';
import { LocationType } from '../../../domain/device-inventory/enums/LocationType';
import { Coordinates } from '../../../domain/device-inventory/value-objects';
import { Result } from '../../../domain/shared/core/Result';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { CreateLocationRequestDTO } from '../dtos/CreateLocationRequestDTO';
import { LocationResponseDTO } from '../dtos/LocationResponseDTO';
import { LocationMapper } from '../mappers/LocationMapper';

/**
 * CreateLocationUseCase
 *
 * Business Intent: Register a new physical or logical location in the system.
 *
 * Flow:
 * 1. beforeExecute: Validate that the name is non-empty and the type is a known
 *    LocationType value. Prevents corrupted aggregates from reaching the domain.
 * 2. executeImpl: Build LocationProps, call Location.create(), persist via
 *    ILocationRepository, and return a LocationResponseDTO.
 *
 * Business Rules:
 * - name is required (1–150 characters).
 * - type must be a valid LocationType enum value.
 * - municipality, neighborhood, address are optional (enforced by the domain).
 * - coordinates are optional; when provided, both latitude and longitude must
 *   be present — this is enforced by the Coordinates value object.
 * - Uniqueness by name is NOT enforced at this layer; the infrastructure/database
 *   layer may enforce it via a unique index if required by a future business rule.
 * - Domain events (LocationCreatedEvent) are dispatched by the repository
 *   after the aggregate is persisted.
 *
 * Dependencies:
 * - ILocationRepository: Persist the Location aggregate.
 * - ILogger: Structured logging via the base UseCase template.
 *
 * @example
 * ```typescript
 * const useCase = new CreateLocationUseCase(locationRepository, logger);
 * const result = await useCase.execute({
 *   name: 'Tower Norte',
 *   type: 'TOWER',
 *   municipality: 'São Paulo',
 *   neighborhood: 'Centro',
 *   address: 'Av. Paulista, 1000',
 *   latitude: -23.561684,
 *   longitude: -46.655981
 * });
 * ```
 */
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

  // ============================================================================
  // Pre-execution validation
  // ============================================================================

  /**
   * Validates the inbound DTO before domain construction begins.
   *
   * Checks performed here (not in executeImpl) because they are
   * boundary-level rejections that do not require domain object creation:
   * - name presence
   * - type membership in the LocationType enum
   * - coordinates coherence (both lat/lon must be present if either is given)
   *
   * The domain's own Guard clauses (inside Location.create) provide a second
   * layer of defence for length constraints and null checks; both layers are
   * intentional (defence-in-depth).
   */
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

    return null; // Validation passed
  }

  // ============================================================================
  // Main execution
  // ============================================================================

  /**
   * Orchestrates location creation.
   *
   * Steps:
   * 1. Map type string to LocationType enum (application-layer concern).
   * 2. Build Coordinates value object when lat/lon are present.
   * 3. Delegate aggregate construction to Location.create().
   * 4. Persist the aggregate via ILocationRepository.
   * 5. Transform the persisted aggregate to a response DTO via LocationMapper.
   *
   * No domain logic lives here — all invariants are enforced inside the
   * Location aggregate and its value objects.
   */
  protected async executeImpl(
    request: CreateLocationRequestDTO
  ): Promise<Result<LocationResponseDTO>> {
    // Map string to domain enum (application-layer orchestration)
    const locationType = request.type.toUpperCase() as LocationType;

    // Build Coordinates value object when coordinates are supplied
    let coordinates: Coordinates | null = null;
    if (request.latitude != null && request.longitude != null) {
      const coordResult = Coordinates.create({
        latitude: request.latitude,
        longitude: request.longitude,
        altitude: request.altitude ?? undefined
      });
      if (coordResult.isFailure) {
        return this.fail(`Invalid coordinates: ${coordResult.error}`);
      }
      coordinates = coordResult.value;
    }

    const now = new Date();

    // Delegate aggregate creation to the domain — no business logic here
    const locationResult = Location.create({
      name: request.name.trim(),
      type: locationType,
      municipality: request.municipality ?? null,
      neighborhood: request.neighborhood ?? null,
      address: request.address ?? null,
      coordinates,
      createdAt: now,
      updatedAt: now
    });

    if (locationResult.isFailure) {
      return this.fail(locationResult.error!);
    }

    const location = locationResult.value;

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
