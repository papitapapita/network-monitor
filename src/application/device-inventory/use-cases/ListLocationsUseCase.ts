import { ILocationRepository } from '../../../domain/device-inventory/repository/ILocationRepository';
import { LocationType } from '../../../domain/device-inventory/enums/LocationType';
import { Result } from '../../../domain/shared/core/Result';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { ListLocationsQueryDTO } from '../dtos/ListLocationsQueryDTO';
import { LocationListResponseDTO } from '../dtos/LocationListResponseDTO';
import { LocationMapper } from '../mappers/LocationMapper';

/**
 * ListLocationsUseCase
 *
 * Business Intent: Retrieve a paginated, optionally filtered list of locations.
 *
 * Flow:
 * 1. executeImpl: Apply pagination defaults/caps, optionally filter by type,
 *    fetch locations and total count, return a LocationListResponseDTO.
 *
 * Features:
 * - Pagination via limit/offset (default limit: 20, max limit: 100).
 * - Optional filter by LocationType.
 * - hasMore flag derived from total count to support cursor-style pagination
 *   on the presentation layer without exposing raw SQL offsets.
 *
 * Business Rules:
 * - Soft-deleted records are NOT included (repository contract).
 * - When a type filter is supplied, only matching locations are returned.
 *   Pagination is applied in-memory because ILocationRepository.findByType
 *   does not accept pagination parameters — consistent with the repository
 *   interface contract.
 * - An invalid type string is a client error and results in a fail Result,
 *   not an exception. The presentation layer is responsible for translating
 *   this to the appropriate HTTP 400 response.
 *
 * Dependencies:
 * - ILocationRepository: Read-only access to the Location aggregate store.
 * - ILogger: Structured logging via the base UseCase template.
 *
 * @example Without filter
 * ```typescript
 * const useCase = new ListLocationsUseCase(locationRepository, logger);
 * const result = await useCase.execute({ limit: 10, offset: 0 });
 * ```
 *
 * @example With type filter
 * ```typescript
 * const result = await useCase.execute({ type: 'TOWER', limit: 50 });
 * ```
 */
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

  // ============================================================================
  // Main execution
  // ============================================================================

  /**
   * Executes the list query.
   *
   * The method intentionally has no beforeExecute override — there are no
   * pre-execution concerns that would benefit from early exit before the
   * repository is touched. Type validation happens inside executeImpl so
   * that the failure path is uniform and clearly associated with a query
   * parameter problem rather than a pre-condition failure.
   */
  protected async executeImpl(
    request: ListLocationsQueryDTO
  ): Promise<Result<LocationListResponseDTO>> {
    // Apply pagination caps — application-layer policy, not domain logic
    const limit = Math.min(
      request.limit ?? ListLocationsUseCase.DEFAULT_LIMIT,
      ListLocationsUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    // Optional type filter
    if (request.type) {
      return this.listByType(request.type, limit, offset);
    }

    // Unfiltered fetch
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

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Retrieves all locations of a specific type and applies pagination
   * in-memory, consistent with how ILocationRepository.findByType is defined.
   *
   * Validates the supplied type string against the LocationType enum before
   * issuing the repository call to surface clear client errors.
   */
  private async listByType(
    typeStr: string,
    limit: number,
    offset: number
  ): Promise<Result<LocationListResponseDTO>> {
    const upperType = typeStr.toUpperCase();
    const validTypes = Object.values(LocationType) as string[];

    if (!validTypes.includes(upperType)) {
      return this.fail<LocationListResponseDTO>(
        `Invalid location type: "${typeStr}". Must be one of: ${validTypes.join(', ')}`
      );
    }

    const locationType = upperType as LocationType;

    const locationsResult =
      await this.locationRepository.findByType(locationType);
    if (locationsResult.isFailure) {
      return this.fail<LocationListResponseDTO>(
        locationsResult.error!
      );
    }

    const allLocations = locationsResult.value;

    // Apply pagination in-memory (findByType does not support limit/offset)
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
