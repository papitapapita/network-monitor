import { PrismaClient } from 'generated/prisma/client';
import { IPAddress, MACAddress } from 'domain/shared';
import { Device } from 'domain/device-inventory/aggregates';
import {
  DeviceId,
  LocationId,
  DeviceModelId
} from 'domain/shared/ids';
import {
  DeviceStatus,
  DeviceCategory
} from 'domain/device-inventory/value-objects';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { Result, EventDispatcher } from 'domain/shared/core';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { DeviceMapper } from '../mappers';

export class PrismaDeviceRepository implements IDeviceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(device: Device): Promise<Result<Device>> {
    try {
      const data = DeviceMapper.toPersistence(device);

      await this.prisma.device.upsert({
        where: { id: data.id },
        create: data,
        update: {
          locationId: data.locationId,
          status: data.status,
          category: data.category,
          owner: data.owner,
          name: data.name,
          serialNumber: data.serialNumber,
          macAddress: data.macAddress,
          ipAddress: data.ipAddress,
          description: data.description,
          installedDate: data.installedDate,
          updatedAt: data.updatedAt,
          monitoringEnabled: data.monitoringEnabled
        }
      });

      EventDispatcher.markAggregateForDispatch(device);
      EventDispatcher.dispatchEventsForAggregate(device.id);

      return Result.ok<Device>(device);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2002')) {
        return Result.fail<Device>(
          'A device with this MAC address or IP address already exists'
        );
      }

      return Result.fail<Device>(
        `Database error saving device: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: DeviceId
  ): Promise<Result<Device | null>> {
    try {
      const raw = await this.prisma.device.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) {
        return Result.ok<Device | null>(null);
      }

      const domainResult = DeviceMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Device | null>(
          `Failed to map device: ${domainResult.error}`
        );
      }

      return Result.ok<Device | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device | null>(
        `Database error finding device: ${errorMessage}`
      );
    }
  }

  public async delete(id: DeviceId): Promise<Result<void>> {
    try {
      await this.prisma.device.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Device not found');
      }

      return Result.fail<void>(
        `Database error deleting device: ${errorMessage}`
      );
    }
  }

  public async exists(id: DeviceId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.device.count({
        where: { id: id.toString() }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device existence: ${errorMessage}`
      );
    }
  }

  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.device.count();
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting devices: ${errorMessage}`
      );
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<Device[]>> {
    try {
      const rawRecords = await this.prisma.device.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding all devices'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding all devices: ${errorMessage}`
      );
    }
  }

  public async findByLocation(
    locationId: LocationId
  ): Promise<Result<Device[]>> {
    try {
      const rawRecords = await this.prisma.device.findMany({
        where: { locationId: locationId.toString() },
        orderBy: { createdAt: 'desc' }
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding devices by location'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding devices by location: ${errorMessage}`
      );
    }
  }

  public async findByLocationIds(
    ids: LocationId[]
  ): Promise<Result<Device[]>> {
    if (ids.length === 0) {
      return Result.ok<Device[]>([]);
    }

    try {
      const rawRecords = await this.prisma.device.findMany({
        where: {
          locationId: { in: ids.map((id) => id.toString()) }
        },
        orderBy: { createdAt: 'desc' }
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding devices by location IDs'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding devices by location IDs: ${errorMessage}`
      );
    }
  }

  public async findByDeviceModel(
    deviceModelId: DeviceModelId
  ): Promise<Result<Device[]>> {
    try {
      const rawRecords = await this.prisma.device.findMany({
        where: { deviceModelId: deviceModelId.toString() },
        orderBy: { createdAt: 'desc' }
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding devices by model'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding devices by model: ${errorMessage}`
      );
    }
  }

  public async findByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<Device | null>> {
    try {
      const raw = await this.prisma.device.findFirst({
        where: { macAddress: macAddress.toString() }
      });

      if (!raw) {
        return Result.ok<Device | null>(null);
      }

      const domainResult = DeviceMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Device | null>(
          `Failed to map device: ${domainResult.error}`
        );
      }

      return Result.ok<Device | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device | null>(
        `Database error finding device by MAC address: ${errorMessage}`
      );
    }
  }

  public async findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<Device | null>> {
    try {
      const raw = await this.prisma.device.findFirst({
        where: { ipAddress: ipAddress.toString() }
      });

      if (!raw) {
        return Result.ok<Device | null>(null);
      }

      const domainResult = DeviceMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Device | null>(
          `Failed to map device: ${domainResult.error}`
        );
      }

      return Result.ok<Device | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device | null>(
        `Database error finding device by IP address: ${errorMessage}`
      );
    }
  }

  public async findByStatus(
    status: DeviceStatus
  ): Promise<Result<Device[]>> {
    try {
      // Prisma's generated type expects enum literal, not string — string cast required
      const rawRecords = await this.prisma.device.findMany({
        where: { status: status.toString() as any },
        orderBy: { createdAt: 'desc' }
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding devices by status'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding devices by status: ${errorMessage}`
      );
    }
  }

  public async existsByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.device.count({
        where: { macAddress: macAddress.toString() }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device existence: ${errorMessage}`
      );
    }
  }

  public async existsByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.device.count({
        where: { ipAddress: ipAddress.toString() }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device existence: ${errorMessage}`
      );
    }
  }

  public async findByFilters(filters: {
    status?: DeviceStatus;
    category?: DeviceCategory;
    owner?: DeviceOwnerType;
    locationId?: LocationId;
    deviceModelId?: DeviceModelId;
    monitoringEnabled?: boolean;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }): Promise<Result<Device[]>> {
    try {
      const where: any = {};

      if (filters.status !== undefined) {
        where.status = filters.status.toString();
      }

      if (filters.category !== undefined) {
        where.category = filters.category.toString();
      }

      if (filters.owner !== undefined) {
        where.owner = filters.owner.toString();
      }

      if (filters.locationId !== undefined) {
        where.locationId = filters.locationId.toString();
      }

      if (filters.deviceModelId !== undefined) {
        where.deviceModelId = filters.deviceModelId.toString();
      }

      if (filters.monitoringEnabled !== undefined) {
        where.monitoringEnabled = filters.monitoringEnabled;
      }

      if (filters.search !== undefined) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          {
            macAddress: {
              contains: filters.search,
              mode: 'insensitive'
            }
          },
          {
            ipAddress: {
              contains: filters.search,
              mode: 'insensitive'
            }
          },
          {
            serialNumber: {
              contains: filters.search,
              mode: 'insensitive'
            }
          }
        ];
      }

      const sortOrder = filters.sortOrder === 'ASC' ? 'asc' : 'desc';
      let orderBy: any = { createdAt: 'desc' };

      if (filters.sortBy !== undefined) {
        orderBy = { [filters.sortBy]: sortOrder };
      }

      const rawRecords = await this.prisma.device.findMany({
        where,
        orderBy,
        take: filters.limit,
        skip: filters.offset
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding devices by filters'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding devices by filters: ${errorMessage}`
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private mapManyToDomain(
    rawRecords: any[],
    _errorContext: string
  ): Result<Device[]> {
    const devices: Device[] = [];
    for (const raw of rawRecords) {
      const domainResult = DeviceMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Device[]>(
          `Failed to map device: ${domainResult.error}`
        );
      }
      devices.push(domainResult.value);
    }
    return Result.ok<Device[]>(devices);
  }
}
