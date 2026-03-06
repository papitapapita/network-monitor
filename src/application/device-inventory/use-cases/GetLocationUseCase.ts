import { LocationId } from '../../../domain/shared/ids';
import { ILocationRepository } from '../../../domain/device-inventory/repository/ILocationRepository';
import { Result } from '../../../domain/shared/core/Result';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { GetLocationRequestDTO } from '../dtos/GetLocationRequestDTO';
import { LocationResponseDTO } from '../dtos/LocationResponseDTO';
import { LocationMapper } from '../mappers/LocationMapper';

/**
 * GetLocationUseCase
 *
 * Business Intent: Retrieve a single location by its unique identifier.
 *
 * Flow:
 * 1. beforeExecute: Validate that id is non-empty.
 * 2. executeImpl: Reconstruct LocationId, query the repository,
 *    and return a LocationResponseDTO or a not-found failure.
 *
 * Business Rules:
 * - id is required and must be non-empty.
 * - Returns a failure Result (not an exception) when the location is not found,
 *   so the presentation layer can map it to HTTP 404.
 *
 * Dependencies:
 * - ILocationRepository: Read-only access to the Location aggregate store.
 * - ILogger: Structured logging via the base UseCase template.
 *
 * @example
 * ```typescript
 * const useCase = new GetLocationUseCase(locationRepository, logger);
 * const result = await useCase.execute({ id: '01HZ1234ABCD' });
 * if (result.isFailure) {
 *   // 'Location not found' → HTTP 404
 * }
 * ```
 */
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

  // ============================================================================
  // Pre-execution validation
  // ============================================================================

  protected async beforeExecute(
    request: GetLocationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Location ID is required');
    }

    return null; // Validation passed
  }

  // ============================================================================
  // Main execution
  // ============================================================================

  protected async executeImpl(
    request: GetLocationRequestDTO
  ): Promise<Result<LocationResponseDTO>> {
    // Parse the raw string into a validated LocationId value object
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
