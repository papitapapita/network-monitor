import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  CatalogModel,
  ConfirmedModelName,
  DeviceByMac,
  DeviceBySerial,
  DeviceHardware,
  IDeviceHardwareQuery,
  ReportedHardware
} from 'application/device-inventory/interfaces';

const SELECT = {
  id: true,
  name: true,
  macAddress: true,
  serialNumber: true,
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
    serialNumber: raw.serialNumber,
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

  // WLS-154: radios with polling on, from their latest snapshot. DEV-215:
  // MikroTiks in service, from their last reading; a router taken out of
  // service keeps its row but drops off, as a retired radio does.
  public async findReportedHardware(): Promise<
    Result<ReportedHardware[]>
  > {
    try {
      const radios = await this.prisma.device.findMany({
        where: {
          deletedAt: null,
          wirelessPollingConfiguration: { enabled: true }
        },
        select: SELECT
      });
      const snapshots =
        radios.length === 0
          ? []
          : await this.prisma.$queryRaw<
              {
                deviceId: string;
                macAddress: string | null;
                deviceModel: string | null;
                collectedAt: Date;
              }[]
            >`
              SELECT DISTINCT ON (device_id)
                device_id::text AS "deviceId",
                mac_address AS "macAddress",
                device_model AS "deviceModel",
                collected_at AS "collectedAt"
              FROM wireless_snapshots
              WHERE device_id = ANY(${radios.map((r) => r.id)}::uuid[])
              ORDER BY device_id, collected_at DESC
            `;
      const latest = new Map(snapshots.map((s) => [s.deviceId, s]));

      const routers = await this.prisma.routerSystemState.findMany({
        where: {
          readAt: { not: null },
          device: {
            deletedAt: null,
            status: { in: ['ACTIVE', 'COMMISSIONING'] }
          }
        },
        select: {
          readAt: true,
          identity: true,
          model: true,
          serialNumber: true,
          macAddress: true,
          device: { select: SELECT }
        }
      });

      const reports: ReportedHardware[] = [];
      for (const radio of radios) {
        const snapshot = latest.get(radio.id);
        if (!snapshot) continue;
        reports.push({
          hardware: toHardware(radio),
          source: 'RADIO',
          reportedAt: snapshot.collectedAt,
          macAddress: snapshot.macAddress,
          deviceModel: snapshot.deviceModel,
          serialNumber: null,
          identity: null
        });
      }
      const seen = new Set(reports.map((r) => r.hardware.deviceId));
      for (const router of routers) {
        if (seen.has(router.device.id)) continue;
        reports.push({
          hardware: toHardware(router.device),
          source: 'ROUTER',
          reportedAt: router.readAt!,
          macAddress: router.macAddress,
          deviceModel: router.model,
          serialNumber: router.serialNumber,
          identity: router.identity
        });
      }
      return Result.ok(reports);
    } catch (error) {
      return Result.fail<ReportedHardware[]>(
        `Database error finding reported device hardware: ${(error as Error).message}`
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

  public async findDevicesBySerial(
    serials: string[]
  ): Promise<Result<DeviceBySerial[]>> {
    if (serials.length === 0) return Result.ok([]);
    try {
      const raws = await this.prisma.$queryRaw<DeviceBySerial[]>`
        SELECT id::text AS "deviceId", name, serial_number AS "serialNumber"
        FROM devices
        WHERE deleted_at IS NULL
          AND upper(btrim(serial_number)) = ANY(${serials.map((s) =>
            s.trim().toUpperCase()
          )}::text[])
      `;
      return Result.ok(raws);
    } catch (error) {
      return Result.fail<DeviceBySerial[]>(
        `Database error finding devices by serial: ${(error as Error).message}`
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
      // them differently. A MikroTik is the same box by its serial.
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
        UNION
        SELECT DISTINCT
          r.model AS "reportedModel",
          d.device_model_id::text AS "deviceModelId"
        FROM router_system_states r
        JOIN devices d ON d.id = r.device_id
        WHERE d.deleted_at IS NULL
          AND r.model IS NOT NULL
          AND upper(btrim(r.serial_number)) = upper(btrim(d.serial_number))
      `;
      return Result.ok(rows);
    } catch (error) {
      return Result.fail<ConfirmedModelName[]>(
        `Database error finding confirmed model names: ${(error as Error).message}`
      );
    }
  }
}
