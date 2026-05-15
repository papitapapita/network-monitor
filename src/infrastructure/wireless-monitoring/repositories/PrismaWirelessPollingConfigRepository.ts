import { PrismaClient } from '../../../generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { WirelessPollingConfigId } from 'domain/shared/ids';
import {
  IWirelessPollingConfigRepository,
  WirelessPollingConfig
} from 'domain/wireless-monitoring';
import { WirelessPollingConfigPrismaMapper } from '../mappers/WirelessPollingConfigPrismaMapper';

type RawPollingConfig = {
  id: string;
  device_id: string;
  ip_address: string | null;
  enabled: boolean;
  interval_secs: number;
  device_type: string;
  link_capacity_bps: bigint | null;
  clients_provisioned_limit: number | null;
  last_polled_at: Date | null;
};

export class PrismaWirelessPollingConfigRepository implements IWirelessPollingConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(config: WirelessPollingConfig): Promise<Result<WirelessPollingConfig>> {
    try {
      const data = WirelessPollingConfigPrismaMapper.toPersistence(config);

      await this.prisma.wirelessPollingConfiguration.upsert({
        where: { deviceId: data.deviceId },
        update: {
          ipAddress: data.ipAddress,
          enabled: data.enabled,
          intervalSecs: data.intervalSecs,
          deviceType: data.deviceType,
          linkCapacityBps: data.linkCapacityBps,
          clientsProvisionedLimit: data.clientsProvisionedLimit,
          lastPolledAt: data.lastPolledAt,
        },
        create: {
          id: data.id,
          deviceId: data.deviceId,
          ipAddress: data.ipAddress,
          enabled: data.enabled,
          intervalSecs: data.intervalSecs,
          deviceType: data.deviceType,
          linkCapacityBps: data.linkCapacityBps,
          clientsProvisionedLimit: data.clientsProvisionedLimit,
          lastPolledAt: data.lastPolledAt,
        },
      });

      return Result.ok(config);
    } catch (error) {
      return Result.fail(`Database error saving wireless polling config: ${(error as Error).message}`);
    }
  }

  async findById(id: WirelessPollingConfigId): Promise<Result<WirelessPollingConfig | null>> {
    try {
      const raw = await this.prisma.wirelessPollingConfiguration.findUnique({
        where: { id: id.toString() },
      });
      if (!raw) return Result.ok(null);
      return Result.ok(WirelessPollingConfigPrismaMapper.toDomain(raw as Parameters<typeof WirelessPollingConfigPrismaMapper.toDomain>[0]));
    } catch (error) {
      return Result.fail(`Database error finding wireless polling config by id: ${(error as Error).message}`);
    }
  }

  async exists(id: WirelessPollingConfigId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.wirelessPollingConfiguration.count({
        where: { id: id.toString() },
      });
      return Result.ok(count > 0);
    } catch (error) {
      return Result.fail(`Database error checking wireless polling config existence: ${(error as Error).message}`);
    }
  }

  async findByDeviceId(deviceId: DeviceId): Promise<Result<WirelessPollingConfig | null>> {
    try {
      const raw = await this.prisma.wirelessPollingConfiguration.findFirst({
        where: { deviceId: deviceId.toString() },
      });
      if (!raw) return Result.ok(null);
      return Result.ok(WirelessPollingConfigPrismaMapper.toDomain(raw as Parameters<typeof WirelessPollingConfigPrismaMapper.toDomain>[0]));
    } catch (error) {
      return Result.fail(`Database error finding wireless polling config: ${(error as Error).message}`);
    }
  }

  async findAllDue(now: Date): Promise<Result<WirelessPollingConfig[]>> {
    try {
      const records = await this.prisma.$queryRaw<RawPollingConfig[]>`
        SELECT
          id,
          device_id,
          ip_address,
          enabled,
          interval_secs,
          device_type,
          link_capacity_bps,
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

      const configs = records.map(r =>
        WirelessPollingConfigPrismaMapper.toDomain({
          id: r.id,
          deviceId: r.device_id,
          ipAddress: r.ip_address,
          enabled: r.enabled,
          intervalSecs: r.interval_secs,
          deviceType: r.device_type,
          linkCapacityBps: r.link_capacity_bps,
          clientsProvisionedLimit: r.clients_provisioned_limit,
          lastPolledAt: r.last_polled_at,
        })
      );

      return Result.ok(configs);
    } catch (error) {
      return Result.fail(`Database error finding due wireless polling configs: ${(error as Error).message}`);
    }
  }

  async delete(deviceId: DeviceId): Promise<Result<void>> {
    try {
      await this.prisma.wirelessPollingConfiguration.deleteMany({
        where: { deviceId: deviceId.toString() },
      });
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(`Database error deleting wireless polling config: ${(error as Error).message}`);
    }
  }
}
