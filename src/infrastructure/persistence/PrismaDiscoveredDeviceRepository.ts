import { PrismaClient } from 'generated/prisma/client';
import { DiscoverySource as PrismaDiscoverySource } from 'generated/prisma/enums';
import { Result } from 'domain/shared/core';
import { DiscoveredDeviceId } from 'domain/shared/ids';
import { DiscoveredDevice } from 'domain/device-inventory/aggregates';
import { IDiscoveredDeviceRepository } from 'domain/device-inventory/repository';
import { DiscoveredDeviceMapper } from '../mappers';

export class PrismaDiscoveredDeviceRepository
  implements IDiscoveredDeviceRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    id: DiscoveredDeviceId
  ): Promise<Result<DiscoveredDevice | null>> {
    try {
      const record = await this.prisma.discoveredDevice.findUnique({
        where: { id: id.toString() }
      });
      return Result.ok(
        record ? DiscoveredDeviceMapper.toDomain(record) : null
      );
    } catch (error) {
      return Result.fail(
        `Database error loading discovered device: ${(error as Error).message}`
      );
    }
  }

  async findByMacs(
    macAddresses: string[]
  ): Promise<Result<DiscoveredDevice[]>> {
    if (macAddresses.length === 0) return Result.ok([]);
    try {
      const records = await this.prisma.discoveredDevice.findMany({
        where: { macAddress: { in: macAddresses } }
      });
      return Result.ok(records.map(DiscoveredDeviceMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error loading discovered devices: ${(error as Error).message}`
      );
    }
  }

  async saveMany(devices: DiscoveredDevice[]): Promise<Result<void>> {
    if (devices.length === 0) return Result.ok();
    try {
      await this.prisma.$transaction(
        devices.map((device) => this.upsert(device))
      );
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving discovered devices: ${(error as Error).message}`
      );
    }
  }

  async save(device: DiscoveredDevice): Promise<Result<void>> {
    try {
      await this.upsert(device);
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving discovered device: ${(error as Error).message}`
      );
    }
  }

  async deleteByMacs(
    macAddresses: string[]
  ): Promise<Result<number>> {
    if (macAddresses.length === 0) return Result.ok(0);
    try {
      const { count } = await this.prisma.discoveredDevice.deleteMany(
        {
          where: { macAddress: { in: macAddresses } }
        }
      );
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `Database error deleting discovered devices: ${(error as Error).message}`
      );
    }
  }

  async deletePendingLastSeenBefore(
    cutoff: Date
  ): Promise<Result<number>> {
    try {
      const { count } = await this.prisma.discoveredDevice.deleteMany(
        {
          where: { ignoredAt: null, lastSeenAt: { lt: cutoff } }
        }
      );
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `Database error purging discovered devices: ${(error as Error).message}`
      );
    }
  }

  // Keyed on the MAC rather than the id: a concurrent sighting of the same
  // new host updates the row the other one created.
  private upsert(device: DiscoveredDevice) {
    const { id, firstSeenAt, ...data } =
      DiscoveredDeviceMapper.toPersistence(device);
    const fields = {
      ...data,
      source: data.source as PrismaDiscoverySource
    };
    return this.prisma.discoveredDevice.upsert({
      where: { macAddress: device.macAddress },
      create: { id, firstSeenAt, ...fields },
      update: fields
    });
  }
}
