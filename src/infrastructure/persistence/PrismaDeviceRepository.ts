import {
  Prisma,
  PrismaClient,
  DeviceStatus as PrismaDeviceStatus
} from 'generated/prisma/client';
import { IPAddress, MACAddress } from 'domain/shared';
import { Device } from 'domain/device-inventory/aggregates';
import {
  AgentId,
  DeviceId,
  LocationId,
  DeviceModelId
} from 'domain/shared/ids';
import { DeviceStatus } from 'domain/device-inventory/value-objects';
import { Result, EventDispatcher } from 'domain/shared/core';
import {
  DeviceFilters,
  IDeviceHardwareSwapRepository,
  IDeviceRepository
} from 'domain/device-inventory/repository';
import { DeviceMapper, PrismaDeviceRecord } from '../mappers';
import { isRecordNotFound, isUniqueViolation } from './prisma-errors';
import {
  DEVICE_LINEAGE_INCLUDE,
  buildDeviceFilterWhere,
  buildDeviceOrderBy
} from './device-listing';

export class PrismaDeviceRepository
  implements IDeviceRepository, IDeviceHardwareSwapRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  // A soft-deleted device does not exist as far as the rest of the system is
  // concerned. Every read below carries this predicate; the two that must see
  // tombstones (restore, purge) say so in their names.
  private static readonly LIVE = { deletedAt: null } as const;

  private static readonly LINEAGE = DEVICE_LINEAGE_INCLUDE;

  public async save(device: Device): Promise<Result<Device>> {
    const data = DeviceMapper.toPersistence(device);

    try {
      await this.prisma.device.upsert({
        where: { id: data.id },
        create: data,
        update: {
          deviceModelId: data.deviceModelId,
          locationId: data.locationId,
          agentId: data.agentId,
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
          monitoringEnabled: data.monitoringEnabled,
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
          replacedAt: data.replacedAt,
          replacesDeviceId: data.replacesDeviceId
        }
      });

      EventDispatcher.markAggregateForDispatch(device);
      EventDispatcher.dispatchEventsForAggregate(device.id);

      return Result.ok<Device>(device);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // The use cases pre-check both fields, so a unique violation here means
      // a concurrent write won the race. Same wording either way, so the
      // caller cannot tell which path rejected it.
      if (isUniqueViolation(error)) {
        if (errorMessage.includes('mac_address')) {
          return Result.fail<Device>(
            `MAC address "${data.macAddress}" is already assigned to another device`
          );
        }

        if (errorMessage.includes('ip_address')) {
          return Result.fail<Device>(
            `IP address "${data.ipAddress}" is already assigned to another device`
          );
        }

        return Result.fail<Device>(
          'A device with this MAC address or IP address already exists'
        );
      }

      return Result.fail<Device>(
        `Database error saving device: ${errorMessage}`
      );
    }
  }

  public async saveHardwareSwap(
    first: Device,
    second: Device
  ): Promise<Result<void>> {
    const a = DeviceMapper.toPersistence(first);
    const b = DeviceMapper.toPersistence(second);

    const hardware = (row: typeof a) => ({
      deviceModelId: row.deviceModelId,
      serialNumber: row.serialNumber,
      macAddress: row.macAddress,
      updatedAt: row.updatedAt
    });

    try {
      // The partial unique index on mac_address is checked per row, so no
      // ordering of two direct writes gets past it. Clearing the first MAC
      // frees the address the second row needs, and the second row's move
      // frees the one the first row ends up with.
      await this.prisma.$transaction([
        this.prisma.device.update({
          where: { id: a.id },
          data: { macAddress: null }
        }),
        this.prisma.device.update({
          where: { id: b.id },
          data: hardware(b)
        }),
        this.prisma.device.update({
          where: { id: a.id },
          data: hardware(a)
        })
      ]);

      for (const device of [first, second]) {
        EventDispatcher.markAggregateForDispatch(device);
        EventDispatcher.dispatchEventsForAggregate(device.id);
      }

      return Result.ok<void>();
    } catch (error) {
      if (isRecordNotFound(error)) {
        return Result.fail<void>(
          'Device not found: one of the devices was removed before the swap could be saved'
        );
      }

      if (isUniqueViolation(error)) {
        return Result.fail<void>(
          'MAC address is already assigned to another device'
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<void>(
        `Database error saving hardware swap: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: DeviceId
  ): Promise<Result<Device | null>> {
    // findFirst, not findUnique: the tombstone predicate is not part of the
    // primary key, and a deleted device must read as absent.
    return this.findOne(
      { id: id.toString(), ...PrismaDeviceRepository.LIVE },
      'Database error finding device'
    );
  }

  // The one read that deliberately sees tombstones — restore has to load the
  // very row every other path is hiding.
  public async findByIdIncludingDeleted(
    id: DeviceId
  ): Promise<Result<Device | null>> {
    return this.findOne(
      { id: id.toString() },
      'Database error finding device'
    );
  }

  // Soft delete is a save(), not a delete() — so this is now only reachable
  // from the purge that runs once the grace period has expired.
  public async delete(id: DeviceId): Promise<Result<void>> {
    try {
      await this.prisma.device.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isRecordNotFound(error)) {
        return Result.fail<void>('Device not found');
      }

      return Result.fail<void>(
        `Database error deleting device: ${errorMessage}`
      );
    }
  }

  public async findDeletedBefore(
    cutoff: Date
  ): Promise<Result<Device[]>> {
    try {
      const rawRecords = await this.prisma.device.findMany({
        where: { deletedAt: { not: null, lte: cutoff } },
        include: PrismaDeviceRepository.LINEAGE,
        orderBy: { deletedAt: 'asc' }
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding devices past their grace period'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding devices past their grace period: ${errorMessage}`
      );
    }
  }

  public async exists(id: DeviceId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.device.count({
        where: {
          id: id.toString(),
          ...PrismaDeviceRepository.LIVE
        }
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
      const count = await this.prisma.device.count({
        where: PrismaDeviceRepository.LIVE
      });
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
        where: PrismaDeviceRepository.LIVE,
        include: PrismaDeviceRepository.LINEAGE,
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
        where: {
          locationId: locationId.toString(),
          ...PrismaDeviceRepository.LIVE
        },
        include: PrismaDeviceRepository.LINEAGE,
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

  public async findByAgent(
    agentId: AgentId | null
  ): Promise<Result<Device[]>> {
    try {
      const rawRecords = await this.prisma.device.findMany({
        where: {
          agentId: agentId?.toString() ?? null,
          ...PrismaDeviceRepository.LIVE
        },
        include: PrismaDeviceRepository.LINEAGE,
        orderBy: { createdAt: 'asc' }
      });

      return this.mapManyToDomain(
        rawRecords,
        'Database error finding devices by agent'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Device[]>(
        `Database error finding devices by agent: ${errorMessage}`
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
          locationId: { in: ids.map((id) => id.toString()) },
          ...PrismaDeviceRepository.LIVE
        },
        include: PrismaDeviceRepository.LINEAGE,
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
        where: {
          deviceModelId: deviceModelId.toString(),
          ...PrismaDeviceRepository.LIVE
        },
        include: PrismaDeviceRepository.LINEAGE,
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
    return this.findOne(
      {
        macAddress: macAddress.toString(),
        ...PrismaDeviceRepository.LIVE
      },
      'Database error finding device by MAC address'
    );
  }

  public async findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<Device | null>> {
    return this.findOne(
      {
        ipAddress: ipAddress.toString(),
        ...PrismaDeviceRepository.LIVE
      },
      'Database error finding device by IP address'
    );
  }

  public async findByStatus(
    status: DeviceStatus
  ): Promise<Result<Device[]>> {
    try {
      // Prisma's generated type expects enum literal, not string — string cast required
      const rawRecords = await this.prisma.device.findMany({
        where: {
          status: status.toString() as PrismaDeviceStatus,
          ...PrismaDeviceRepository.LIVE
        },
        include: PrismaDeviceRepository.LINEAGE,
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
        where: {
          macAddress: macAddress.toString(),
          ...PrismaDeviceRepository.LIVE
        }
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
        where: {
          ipAddress: ipAddress.toString(),
          ...PrismaDeviceRepository.LIVE
        }
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

  public async findByFilters(
    filters: DeviceFilters
  ): Promise<Result<Device[]>> {
    try {
      const rawRecords = await this.prisma.device.findMany({
        where: buildDeviceFilterWhere(filters),
        include: PrismaDeviceRepository.LINEAGE,
        orderBy: buildDeviceOrderBy(
          filters.sortBy,
          filters.sortOrder
        ),
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

  private async findOne(
    where: Prisma.DeviceWhereInput,
    errorContext: string
  ): Promise<Result<Device | null>> {
    try {
      const raw = await this.prisma.device.findFirst({
        where,
        include: PrismaDeviceRepository.LINEAGE
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
        `${errorContext}: ${errorMessage}`
      );
    }
  }

  private mapManyToDomain(
    rawRecords: PrismaDeviceRecord[],
    errorContext: string
  ): Result<Device[]> {
    const devices: Device[] = [];
    for (const raw of rawRecords) {
      const domainResult = DeviceMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Device[]>(
          `${errorContext}: Failed to map device: ${domainResult.error}`
        );
      }
      devices.push(domainResult.value);
    }
    return Result.ok<Device[]>(devices);
  }
}
