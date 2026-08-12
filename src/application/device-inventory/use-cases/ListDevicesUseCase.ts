import { IDeviceRepository } from 'domain/device-inventory/repository';
import {
  DeviceStatus,
  DeviceCategory
} from 'domain/device-inventory/value-objects';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { DeviceModelId, LocationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ListDevicesQueryDTO, DeviceListResponseDTO } from '../dtos';
import { DeviceMapper } from '../mappers';

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

  protected async executeImpl(
    request: ListDevicesQueryDTO
  ): Promise<Result<DeviceListResponseDTO>> {
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

  private hasActiveFilters(request: ListDevicesQueryDTO): boolean {
    return (
      request.status != null ||
      request.category != null ||
      request.owner != null ||
      request.locationId != null ||
      request.deviceModelId != null ||
      request.monitoringEnabled != null ||
      request.deleted != null ||
      request.search != null
    );
  }

  private async listAll(
    limit: number,
    offset: number
  ): Promise<Result<DeviceListResponseDTO>> {
    const devicesResult = await this.deviceRepository.findAll(
      limit,
      offset
    );
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

  private async listByFilters(
    request: ListDevicesQueryDTO,
    limit: number,
    offset: number
  ): Promise<Result<DeviceListResponseDTO>> {
    let statusFilter: DeviceStatus | undefined;
    if (request.status) {
      const statusResult = DeviceStatus.create(request.status);
      if (statusResult.isFailure) {
        return this.fail<DeviceListResponseDTO>(statusResult.error!);
      }
      statusFilter = statusResult.value;
    }

    let categoryFilter: DeviceCategory | undefined;
    if (request.category) {
      const categoryResult = DeviceCategory.create(request.category);
      if (categoryResult.isFailure) {
        return this.fail<DeviceListResponseDTO>(
          categoryResult.error!
        );
      }
      categoryFilter = categoryResult.value;
    }

    let ownerFilter: DeviceOwnerType | undefined;
    if (request.owner) {
      const validOwnerTypes = Object.values(
        DeviceOwnerType
      ) as string[];
      const upperOwner = request.owner.toUpperCase();
      if (!validOwnerTypes.includes(upperOwner)) {
        return this.fail<DeviceListResponseDTO>(
          `Invalid owner type: "${request.owner}". Must be one of: ${validOwnerTypes.join(', ')}`
        );
      }
      ownerFilter = upperOwner as DeviceOwnerType;
    }

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

    let deviceModelIdFilter: DeviceModelId | undefined;
    if (request.deviceModelId) {
      const deviceModelIdResult = DeviceModelId.parse(
        request.deviceModelId
      );
      if (deviceModelIdResult.isFailure) {
        return this.fail<DeviceListResponseDTO>(
          `Invalid deviceModelId: ${deviceModelIdResult.error}`
        );
      }
      deviceModelIdFilter = deviceModelIdResult.value;
    }

    const filters = {
      status: statusFilter,
      category: categoryFilter,
      owner: ownerFilter,
      locationId: locationIdFilter,
      deviceModelId: deviceModelIdFilter,
      monitoringEnabled: request.monitoringEnabled,
      deleted: request.deleted,
      search: request.search,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder
    };

    const devicesResult = await this.deviceRepository.findByFilters({
      ...filters,
      limit,
      offset
    });

    if (devicesResult.isFailure) {
      return this.fail<DeviceListResponseDTO>(devicesResult.error!);
    }

    const countResult =
      await this.deviceRepository.countByFilters(filters);

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
}
