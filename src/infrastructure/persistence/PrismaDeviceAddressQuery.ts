import { PrismaClient, Prisma } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  DeviceAddressRow,
  IDeviceAddressQuery
} from 'application/device-inventory/interfaces';

const SELECT = {
  id: true,
  name: true,
  status: true,
  ipAddress: true,
  macAddress: true,
  routerSystemState: { select: { macAddress: true } }
} as const;

type DeviceRecord = Prisma.DeviceGetPayload<{
  select: typeof SELECT;
}>;

export class PrismaDeviceAddressQuery implements IDeviceAddressQuery {
  constructor(private readonly prisma: PrismaClient) {}

  public async findAll(): Promise<Result<DeviceAddressRow[]>> {
    try {
      const devices = await this.prisma.device.findMany({
        where: {
          deletedAt: null,
          OR: [
            { ipAddress: { not: null } },
            { macAddress: { not: null } }
          ]
        },
        select: SELECT,
        orderBy: { name: 'asc' }
      });
      return Result.ok(await this.toRows(devices));
    } catch (error) {
      return Result.fail(
        `Database error loading device addresses: ${(error as Error).message}`
      );
    }
  }

  public async findById(
    deviceId: string
  ): Promise<Result<DeviceAddressRow | null>> {
    try {
      const device = await this.prisma.device.findFirst({
        where: { id: deviceId, deletedAt: null },
        select: SELECT
      });
      if (!device) return Result.ok(null);
      return Result.ok((await this.toRows([device]))[0]!);
    } catch (error) {
      return Result.fail(
        `Database error loading device addresses: ${(error as Error).message}`
      );
    }
  }

  private async toRows(
    devices: DeviceRecord[]
  ): Promise<DeviceAddressRow[]> {
    const snapshots =
      devices.length === 0
        ? []
        : await this.prisma.$queryRaw<
            { deviceId: string; macAddress: string | null }[]
          >`
            SELECT DISTINCT ON (device_id)
              device_id::text AS "deviceId",
              mac_address AS "macAddress"
            FROM wireless_snapshots
            WHERE device_id = ANY(${devices.map((d) => d.id)}::uuid[])
            ORDER BY device_id, collected_at DESC
          `;
    const radioMac = new Map(
      snapshots.map((s) => [s.deviceId, s.macAddress])
    );
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: device.status,
      ipAddress: device.ipAddress,
      macAddresses: [
        device.macAddress,
        radioMac.get(device.id),
        device.routerSystemState?.macAddress
      ]
        .map((mac) => mac?.trim().replace(/-/g, ':').toUpperCase())
        .filter(
          (mac, i, all): mac is string =>
            !!mac && all.indexOf(mac) === i
        )
    }));
  }
}
