import { IDeviceRepository } from '../../../domain/device-inventory/repository/IDeviceRepository';
import { DeviceStatus } from '../../../domain/device-inventory/value-objects/DeviceStatus';
import { DeviceCategory } from '../../../domain/device-inventory/value-objects/DeviceCategory';
import { DeviceOwnerType } from '../../../domain/device-inventory/enums/DeviceOwnerType';
import { DeviceModelId, LocationId } from '../../../domain/shared/ids';
import { Result } from '../../../domain/shared/core/Result';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { ListDevicesQueryDTO } from '../dtos/ListDevicesQueryDTO';
import { DeviceListResponseDTO } from '../dtos/DeviceListResponseDTO';
import { DeviceMapper } from '../mappers/DeviceMapper';

/**
 * ListDevicesUseCase
 *
 * Business Intent: Retrieve a paginated, optionally filtered list of physical devices.
 *
 * Flow:
 * 1. executeImpl: Apply pagination defaults/caps, validate and build filter
 *    value objects, fetch devices from the repository, apply in-memory
 *    pagination when filters are active, return a DeviceListResponseDTO.
 *
 * Features:
 * - Pagination via limit/offset (default limit: 20, max limit: 100).
 * - Optional filtering by status, category, owner, locationId, deviceModelId,
 *   monitoringEnabled, and free-text search.
 * - Sorting by name, status, createdAt, or updatedAt.
 * - hasMore flag derived from total count to support cursor-style pagination.
 *
 * Business Rules:
 * - Enum-typed filter values are case-insensitive; invalid values return
 *   Result.fail() rather than throwing.
 * - When filters are present, findByFilters is called without pagination
 *   parameters to obtain the full matching set; pagination is applied
 *   in-memory — consistent with ILocationRepository.findByType behaviour.
 * - When no filters are present, findAll + count are used for efficient
 *   DB-level pagination.
 *
 * Dependencies:
 * - IDeviceRepository: Read-only access to the Device aggregate store.
 * - ILogger: Structured logging via the base UseCase template.
 *
 * @example Without filters
 * ```typescript
 * const result = await useCase.execute({ limit: 20, offset: 0 });
 * ```
 *
 * @example With filters
 * ```typescript
 * const result = await useCase.execute({
 *   status: 'ACTIVE',
 *   category: 'CORE',
 *   owner: 'COMPANY',
 *   monitoringEnabled: true,
 *   sortBy: 'name',
 *   sortOrder: 'ASC',
 *   limit: 50
 * });
 * ```
 */
export class ListDevicesUseCase extends UseCase<
  ListDevicesQueryDTO,
  DeviceListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'ListDevicesUseCase');
  }

  // ============================================================================
  // Main execution
  // ============================================================================

  /**
   * Executes the list query.
   *
   * No beforeExecute override — filter validation happens inside executeImpl
   * so that the failure path is uniform and clearly associated with a query
   * parameter problem rather than a pre-condition failure.
   */
  protected async executeImpl(
    request: ListDevicesQueryDTO
  ): Promise<Result<DeviceListResponseDTO>> {
    // Apply pagination caps — application-layer policy, not domain logic
    const limit = Math.min(
      request.limit ?? ListDevicesUseCase.DEFAULT_LIMIT,
      ListDevicesUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const hasFilters = this.hasActiveFilters(request);

    if (!hasFilters) {
      return this.listAll(limit, offset);
    }

    return this.listByFilters(request, limit, offset);
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Returns true when the query contains at least one active filter criterion
   * (excluding pagination and sort parameters, which are always present).
   */
  private hasActiveFilters(request: ListDevicesQueryDTO): boolean {
    return (
      request.status != null ||
      request.category != null ||
      request.owner != null ||
      request.locationId != null ||
      request.deviceModelId != null ||
      request.monitoringEnabled != null ||
      request.search != null
    );
  }

  /**
   * Retrieves all devices with DB-level pagination.
   * Used when no filter criteria are provided for maximum efficiency.
   */
  private async listAll(
    limit: number,
    offset: number
  ): Promise<Result<DeviceListResponseDTO>> {
    const devicesResult = await this.deviceRepository.findAll(limit, offset);
    if (devicesResult.isFailure) {
      return this.fail<DeviceListResponseDTO>(devicesResult.error!);
    }

    const countResult = await this.deviceRepository.count();
    if (countResult.isFailure) {
      return this.fail<DeviceListResponseDTO>(countResult.error!);
    }

    return this.ok<DeviceListResponseDTO>(
      DeviceMapper.toListDTO(
        devicesResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }

  /**
   * Retrieves devices matching the supplied filter criteria.
   * Fetches the full matching set from the repository, then applies
   * pagination in-memory — consistent with how ILocationRepository.findByType
   * is handled in ListLocationsUseCase.
   *
   * Validates all enum-typed filter parameters before issuing the
   * repository call to surface clear client errors.
   */
  private async listByFilters(
    request: ListDevicesQueryDTO,
    limit: number,
    offset: number
  ): Promise<Result<DeviceListResponseDTO>> {
    // Validate and build DeviceStatus filter
    let statusFilter: DeviceStatus | undefined;
    if (request.status) {
      const statusResult = DeviceStatus.create(request.status);
      if (statusResult.isFailure) {
        return this.fail<DeviceListResponseDTO>(statusResult.error!);
      }
      statusFilter = statusResult.value;
    }

    // Validate and build DeviceCategory filter
    let categoryFilter: DeviceCategory | undefined;
    if (request.category) {
      const categoryResult = DeviceCategory.create(request.category);
      if (categoryResult.isFailure) {
        return this.fail<DeviceListResponseDTO>(categoryResult.error!);
      }
      categoryFilter = categoryResult.value;
    }

    // Validate and build DeviceOwnerType filter
    let ownerFilter: DeviceOwnerType | undefined;
    if (request.owner) {
      const validOwnerTypes = Object.values(DeviceOwnerType) as string[];
      const upperOwner = request.owner.toUpperCase();
      if (!validOwnerTypes.includes(upperOwner)) {
        return this.fail<DeviceListResponseDTO>(
          `Invalid owner type: "${request.owner}". Must be one of: ${validOwnerTypes.join(', ')}`
        );
      }
      ownerFilter = upperOwner as DeviceOwnerType;
    }

    // Validate and build LocationId filter
    let locationIdFilter: LocationId | undefined;
    if (request.locationId) {
      const locationIdResult = LocationId.parse(request.locationId);
      if (locationIdResult.isFailure) {
        return this.fail<DeviceListResponseDTO>(
          `Invalid locationId: ${locationIdResult.error}`
        );
      }
      locationIdFilter = locationIdResult.value;
    }

    // Validate and build DeviceModelId filter
    let deviceModelIdFilter: DeviceModelId | undefined;
    if (request.deviceModelId) {
      const deviceModelIdResult = DeviceModelId.parse(request.deviceModelId);
      if (deviceModelIdResult.isFailure) {
        return this.fail<DeviceListResponseDTO>(
          `Invalid deviceModelId: ${deviceModelIdResult.error}`
        );
      }
      deviceModelIdFilter = deviceModelIdResult.value;
    }

    // Fetch all matching devices (no limit/offset — we paginate in-memory)
    const devicesResult = await this.deviceRepository.findByFilters({
      status: statusFilter,
      category: categoryFilter,
      owner: ownerFilter,
      locationId: locationIdFilter,
      deviceModelId: deviceModelIdFilter,
      monitoringEnabled: request.monitoringEnabled,
      search: request.search,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder
    });

    if (devicesResult.isFailure) {
      return this.fail<DeviceListResponseDTO>(devicesResult.error!);
    }

    const allDevices = devicesResult.value;

    // Apply pagination in-memory (findByFilters does not return a total count)
    const paginatedDevices = allDevices.slice(offset, offset + limit);

    return this.ok<DeviceListResponseDTO>(
      DeviceMapper.toListDTO(paginatedDevices, allDevices.length, limit, offset)
    );
  }
}
