import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  CatalogModel,
  ConfirmedModelName,
  DeviceByMac,
  DeviceHardware,
  IDeviceHardwareQuery
} from 'application/wireless-monitoring/interfaces';

const SELECT = {
  id: true,
  name: true,
  macAddress: true,
  status: true,
  deviceModel: { select: { id: true, model: true, vendorId: true } }
} as const;

type DeviceHardwareRecord = Prisma.DeviceGetPayload<{
  select: typeof SELECT;
}>;

function toHardware(raw: DeviceHardwareRecord): DeviceHardware {
  return {
    deviceId: raw.id,
    name: raw.name,
    macAddress: raw.macAddress,
    inInventory: raw.status === 'INVENTORY',
    deviceModelId: raw.deviceModel.id,
    modelName: raw.deviceModel.model,
    vendorId: raw.deviceModel.vendorId
  };
}

export class PrismaDeviceHardwareQuery
  implements IDeviceHardwareQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  public async findHardware(
    deviceId: DeviceId
  ): Promise<Result<DeviceHardware | null>> {
    try {
      const raw = await this.prisma.device.findFirst({
        where: { id: deviceId.toString(), deletedAt: null },
        select: SELECT
      });
      return Result.ok(raw ? toHardware(raw) : null);
    } catch (error) {
      return Result.fail<DeviceHardware | null>(
        `Database error finding device hardware: ${(error as Error).message}`
      );
    }
  }

  public async findPolledHardware(): Promise<
    Result<DeviceHardware[]>
  > {
    try {
      const raws = await this.prisma.device.findMany({
        where: {
          deletedAt: null,
          wirelessPollingConfiguration: { enabled: true }
        },
        select: SELECT
      });
      return Result.ok(raws.map(toHardware));
    } catch (error) {
      return Result.fail<DeviceHardware[]>(
        `Database error finding polled device hardware: ${(error as Error).message}`
      );
    }
  }

  public async findDevicesByMac(
    macs: string[]
  ): Promise<Result<DeviceByMac[]>> {
    if (macs.length === 0) return Result.ok([]);
    try {
      const raws = await this.prisma.device.findMany({
        where: { deletedAt: null, macAddress: { in: macs } },
        select: { id: true, name: true, macAddress: true }
      });
      return Result.ok(
        raws.map((r) => ({
          deviceId: r.id,
          name: r.name,
          macAddress: r.macAddress!
        }))
      );
    } catch (error) {
      return Result.fail<DeviceByMac[]>(
        `Database error finding devices by MAC: ${(error as Error).message}`
      );
    }
  }

  public async findCatalogModels(): Promise<Result<CatalogModel[]>> {
    try {
      const raws = await this.prisma.deviceModel.findMany({
        select: { id: true, model: true, vendorId: true }
      });
      return Result.ok(raws);
    } catch (error) {
      return Result.fail<CatalogModel[]>(
        `Database error listing catalog models: ${(error as Error).message}`
      );
    }
  }

  public async findConfirmedModelNames(): Promise<
    Result<ConfirmedModelName[]>
  > {
    try {
      // MACs are compared as bare hex digits: AirOS and inventory format
      // them differently.
      const rows = await this.prisma.$queryRaw<ConfirmedModelName[]>`
        SELECT DISTINCT
          s.device_model AS "reportedModel",
          d.device_model_id::text AS "deviceModelId"
        FROM (
          SELECT DISTINCT ON (device_id) device_id, mac_address, device_model
          FROM wireless_snapshots
          ORDER BY device_id, collected_at DESC
        ) s
        JOIN devices d ON d.id = s.device_id
        WHERE d.deleted_at IS NULL
          AND s.device_model IS NOT NULL
          AND upper(regexp_replace(s.mac_address, '[^0-9A-Fa-f]', '', 'g')) =
              upper(regexp_replace(d.mac_address, '[^0-9A-Fa-f]', '', 'g'))
      `;
      return Result.ok(rows);
    } catch (error) {
      return Result.fail<ConfirmedModelName[]>(
        `Database error finding confirmed model names: ${(error as Error).message}`
      );
    }
  }
}
