import {
  Result,
  NetworkDeviceStatus,
  NetworkDeviceType
} from '../../../domain/device-inventory';
import { INetworkDeviceRepository } from '../../../domain/device-inventory/repository/INetworkDeviceRepository';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import {
  ListNetworkDevicesQueryDTO,
  NetworkDeviceListResponseDTO
} from '../dtos/network-device/NetworkDeviceDTO';
import { NetworkDeviceMapper } from '../mappers/NetworkDeviceMapper';

/**
 * ListNetworkDevicesUseCase
 *
 * Lists network devices with pagination and optional filtering.
 *
 * Features:
 * - Pagination (limit/offset)
 * - Filter by status
 * - Filter by device type
 * - Total count for "hasMore" calculation
 */
export class ListNetworkDevicesUseCase extends UseCase<
  ListNetworkDevicesQueryDTO,
  NetworkDeviceListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'ListNetworkDevicesUseCase');
  }

  protected async executeImpl(
    request: ListNetworkDevicesQueryDTO
  ): Promise<Result<NetworkDeviceListResponseDTO>> {
    // Validate and set pagination params
    const limit = Math.min(
      request.limit || ListNetworkDevicesUseCase.DEFAULT_LIMIT,
      ListNetworkDevicesUseCase.MAX_LIMIT
    );
    const offset = request.offset || 0;

    // If status filter provided, fetch by status
    if (request.status) {
      return await this.listByStatus(request.status, limit, offset);
    }

    // Otherwise, fetch all devices
    const devicesResult = await this.deviceRepository.findAll(
      limit,
      offset
    );
    if (devicesResult.isFailure) {
      return this.fail<NetworkDeviceListResponseDTO>(
        devicesResult.error!
      );
    }

    // Get total count
    const countResult = await this.deviceRepository.count();
    if (countResult.isFailure) {
      return this.fail<NetworkDeviceListResponseDTO>(
        countResult.error!
      );
    }

    // Convert to list DTO
    const listDTO = NetworkDeviceMapper.toListDTO(
      devicesResult.value,
      countResult.value,
      limit,
      offset
    );

    return this.ok<NetworkDeviceListResponseDTO>(listDTO);
  }

  /**
   * Lists devices filtered by status.
   */
  private async listByStatus(
    statusStr: string,
    limit: number,
    offset: number
  ): Promise<Result<NetworkDeviceListResponseDTO>> {
    // Validate status
    const upperStatus = statusStr.toUpperCase();
    if (
      !Object.values(NetworkDeviceStatus).includes(
        upperStatus as NetworkDeviceStatus
      )
    ) {
      return this.fail<NetworkDeviceListResponseDTO>(
        `Invalid status: ${statusStr}. Must be one of: ONLINE, OFFLINE, MAINTENANCE`
      );
    }

    const status = upperStatus as NetworkDeviceStatus;

    // Fetch devices by status
    const devicesResult =
      await this.deviceRepository.findByStatus(status);
    if (devicesResult.isFailure) {
      return this.fail<NetworkDeviceListResponseDTO>(
        devicesResult.error!
      );
    }

    // Apply pagination manually (since findByStatus doesn't support it)
    const allDevices = devicesResult.value;
    const paginatedDevices = allDevices.slice(offset, offset + limit);

    // Convert to list DTO
    const listDTO = NetworkDeviceMapper.toListDTO(
      paginatedDevices,
      allDevices.length,
      limit,
      offset
    );

    return this.ok<NetworkDeviceListResponseDTO>(listDTO);
  }
}
