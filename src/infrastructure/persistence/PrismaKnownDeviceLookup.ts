import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IKnownDeviceLookup,
  KnownDeviceOwners
} from 'application/device-inventory/interfaces';

export class PrismaKnownDeviceLookup implements IKnownDeviceLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async findOwners(
    macAddresses: string[],
    ipAddresses: string[]
  ): Promise<Result<KnownDeviceOwners>> {
    const owners: KnownDeviceOwners = {
      byMac: new Map(),
      byIp: new Map()
    };
    if (macAddresses.length === 0 && ipAddresses.length === 0) {
      return Result.ok(owners);
    }
    try {
      const devices = await this.prisma.device.findMany({
        where: {
          deletedAt: null,
          OR: [
            { macAddress: { in: macAddresses } },
            { ipAddress: { in: ipAddresses } }
          ]
        },
        select: { id: true, macAddress: true, ipAddress: true }
      });
      for (const device of devices) {
        if (device.macAddress)
          owners.byMac.set(device.macAddress, device.id);
        if (device.ipAddress && !owners.byIp.has(device.ipAddress)) {
          owners.byIp.set(device.ipAddress, device.id);
        }
      }
      return Result.ok(owners);
    } catch (error) {
      return Result.fail(
        `Database error matching devices: ${(error as Error).message}`
      );
    }
  }
}
