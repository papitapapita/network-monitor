import {
  PrismaClient,
  WirelessDeviceType
} from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId, WirelessDeviceConfigId } from 'domain/shared/ids';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { WirelessDeviceConfig } from 'domain/wireless-monitoring/aggregates';
import { WirelessDeviceConfigPrismaMapper } from '../mappers/';

type RawPollingConfig = {
  id: string;
  device_id: string;
  ip_address: string | null;
  enabled: boolean;
  interval_secs: number;
  device_type: string;
  link_capacity_kbps: bigint | null;
  clients_provisioned_limit: number | null;
  last_polled_at: Date | null;
};

export class PrismaWirelessDeviceConfigRepository
  implements IWirelessDeviceConfigRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async save(
    config: WirelessDeviceConfig
  ): Promise<Result<WirelessDeviceConfig>> {
    try {
      const data =
        WirelessDeviceConfigPrismaMapper.toPersistence(config);

      await this.prisma.wirelessPollingConfiguration.upsert({
        where: { deviceId: data.deviceId },
        update: {
          ipAddress: data.ipAddress,
          enabled: data.enabled,
          intervalSecs: data.intervalSecs,
          deviceType: data.deviceType as WirelessDeviceType,
          linkCapacityKbps: data.linkCapacityKbps,
          clientsProvisionedLimit: data.clientsProvisionedLimit,
          lastPolledAt: data.lastPolledAt
        },
        create: {
          id: data.id,
          deviceId: data.deviceId,
          ipAddress: data.ipAddress,
          enabled: data.enabled,
          intervalSecs: data.intervalSecs,
          deviceType: data.deviceType as WirelessDeviceType,
          linkCapacityKbps: data.linkCapacityKbps,
          clientsProvisionedLimit: data.clientsProvisionedLimit,
          lastPolledAt: data.lastPolledAt
        }
      });

      return Result.ok(config);
    } catch (error) {
      return Result.fail(
        `Database error saving wireless polling config: ${(error as Error).message}`
      );
    }
  }

  async findById(
    id: WirelessDeviceConfigId
  ): Promise<Result<WirelessDeviceConfig | null>> {
    try {
      const raw =
        await this.prisma.wirelessPollingConfiguration.findUnique({
          where: { id: id.toString() }
        });
      if (!raw) return Result.ok(null);
      // Prisma return type is broader than the mapper's narrowed type — cast required
      return Result.ok(
        WirelessDeviceConfigPrismaMapper.toDomain(
          raw as Parameters<
            typeof WirelessDeviceConfigPrismaMapper.toDomain
          >[0]
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding wireless polling config by id: ${(error as Error).message}`
      );
    }
  }

  async exists(id: WirelessDeviceConfigId): Promise<Result<boolean>> {
    try {
      const count =
        await this.prisma.wirelessPollingConfiguration.count({
          where: { id: id.toString() }
        });
      return Result.ok(count > 0);
    } catch (error) {
      return Result.fail(
        `Database error checking wireless polling config existence: ${(error as Error).message}`
      );
    }
  }

  async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<WirelessDeviceConfig | null>> {
    try {
      const raw =
        await this.prisma.wirelessPollingConfiguration.findFirst({
          where: { deviceId: deviceId.toString() }
        });
      if (!raw) return Result.ok(null);
      return Result.ok(
        WirelessDeviceConfigPrismaMapper.toDomain(
          raw as Parameters<
            typeof WirelessDeviceConfigPrismaMapper.toDomain
          >[0]
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding wireless polling config: ${(error as Error).message}`
      );
    }
  }

  async findAll(): Promise<Result<WirelessDeviceConfig[]>> {
    try {
      const raws =
        await this.prisma.wirelessPollingConfiguration.findMany();
      return Result.ok(
        raws.map((r) =>
          WirelessDeviceConfigPrismaMapper.toDomain(
            r as Parameters<
              typeof WirelessDeviceConfigPrismaMapper.toDomain
            >[0]
          )
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error listing wireless polling configs: ${(error as Error).message}`
      );
    }
  }

  async findAllDue(
    now: Date
  ): Promise<Result<WirelessDeviceConfig[]>> {
    try {
      const records = await this.prisma.$queryRaw<RawPollingConfig[]>`
        SELECT
          id,
          device_id,
          ip_address,
          enabled,
          interval_secs,
          device_type,
          link_capacity_kbps,
          clients_provisioned_limit,
          last_polled_at
        FROM wireless_polling_configurations
        WHERE enabled = true
          AND ip_address IS NOT NULL
          AND (
            last_polled_at IS NULL
            OR last_polled_at + (interval_secs || ' seconds')::interval <= ${now}
          )
      `;

      const configs = records.map((r) =>
        WirelessDeviceConfigPrismaMapper.toDomain({
          id: r.id,
          deviceId: r.device_id,
          ipAddress: r.ip_address,
          enabled: r.enabled,
          intervalSecs: r.interval_secs,
          deviceType: r.device_type,
          linkCapacityKbps: r.link_capacity_kbps,
          clientsProvisionedLimit: r.clients_provisioned_limit,
          lastPolledAt: r.last_polled_at
        })
      );

      return Result.ok(configs);
    } catch (error) {
      return Result.fail(
        `Database error finding due wireless polling configs: ${(error as Error).message}`
      );
    }
  }

  async delete(deviceId: DeviceId): Promise<Result<void>> {
    try {
      await this.prisma.wirelessPollingConfiguration.deleteMany({
        where: { deviceId: deviceId.toString() }
      });
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        `Database error deleting wireless polling config: ${(error as Error).message}`
      );
    }
  }
}
