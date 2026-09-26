import {
  DeviceStatus,
  DeviceCategory
} from 'domain/device-inventory/value-objects';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { DeviceModelId, LocationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ListDevicesQueryDTO,
  DeviceListResponseDTO,
  ConnectivityStatus
} from '../dtos';
import { DeviceMapper } from '../mappers';
import { IDeviceListQuery } from '../interfaces';

export class ListDevicesUseCase extends UseCase<
  ListDevicesQueryDTO,
  DeviceListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;
  private static readonly CONNECTIVITY_VALUES: readonly ConnectivityStatus[] =
    ['UP', 'DOWN', 'UNKNOWN'];

  constructor(
    private readonly deviceListQuery: IDeviceListQuery,
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

    // Every request, filtered or not, resolves through the list/count pair:
    // it is the only path that orders at the database level before
    // paginating.
    return this.listByFilters(request, limit, offset);
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

    let connectivityFilter: ConnectivityStatus | undefined;
    if (request.connectivity !== undefined) {
      const connectivity =
        ListDevicesUseCase.CONNECTIVITY_VALUES.find(
          (value) => value === request.connectivity
        );
      if (connectivity === undefined) {
        return this.fail<DeviceListResponseDTO>(
          `Invalid connectivity: "${request.connectivity}". Must be one of: ${ListDevicesUseCase.CONNECTIVITY_VALUES.join(', ')}`
        );
      }
      connectivityFilter = connectivity;
    }

    const criteria = {
      status: statusFilter,
      category: categoryFilter,
      owner: ownerFilter,
      locationId: locationIdFilter,
      deviceModelId: deviceModelIdFilter,
      monitoringEnabled: request.monitoringEnabled,
      deleted: request.deleted,
      search: request.search,
      connectivity: connectivityFilter,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder
    };

    const devicesResult = await this.deviceListQuery.list({
      ...criteria,
      limit,
      offset
    });

    if (devicesResult.isFailure) {
      return this.fail<DeviceListResponseDTO>(devicesResult.error!);
    }

    const countResult = await this.deviceListQuery.count(criteria);

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
