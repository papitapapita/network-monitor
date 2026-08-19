import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId, PollingConfigurationId } from 'domain/shared/ids';
import { PollingConfiguration } from 'domain/device-monitoring/entities';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { PollingConfigurationMapper } from '../mappers';

export class PrismaPollingConfigurationRepository
  implements IPollingConfigurationRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    id: PollingConfigurationId
  ): Promise<Result<PollingConfiguration | null>> {
    try {
      const record =
        await this.prisma.pollingConfiguration.findUnique({
          where: { id: id.toString() }
        });

      if (!record) return Result.ok(null);

      return Result.ok(PollingConfigurationMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `Database error finding polling config: ${(error as Error).message}`
      );
    }
  }

  async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<PollingConfiguration | null>> {
    try {
      const record =
        await this.prisma.pollingConfiguration.findUnique({
          where: { deviceId: deviceId.toString() }
        });

      if (!record) return Result.ok(null);

      return Result.ok(PollingConfigurationMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `Database error finding polling config: ${(error as Error).message}`
      );
    }
  }

  async findAllDue(
    now: Date
  ): Promise<Result<PollingConfiguration[]>> {
    try {
      const records = await this.prisma.$queryRaw<
        Array<{
          id: string;
          device_id: string;
          ip_address: string | null;
          enabled: boolean;
          interval_seconds: number;
          failures_before_down: number;
          last_polled_at: Date | null;
        }>
      >`
        SELECT pc.id, pc.device_id, pc.ip_address, pc.enabled,
               pc.interval_seconds, pc.failures_before_down, pc.last_polled_at
        FROM polling_configurations pc
        JOIN devices d ON d.id = pc.device_id
        LEFT JOIN device_states ds ON ds.device_id = pc.device_id
        WHERE pc.enabled = true
          AND pc.ip_address IS NOT NULL
          AND d.deleted_at IS NULL
          AND d.status IN ('ACTIVE', 'COMMISSIONING')
          AND (
            ds.last_checked_at IS NULL
            OR ds.last_checked_at + (pc.interval_seconds || ' seconds')::interval <= ${now}
          )
      `;

      const entities = records.map((r) =>
        PollingConfigurationMapper.toDomain({
          id: r.id,
          deviceId: r.device_id,
          ipAddress: r.ip_address,
          enabled: r.enabled,
          pingIntervalSecs: r.interval_seconds,
          failuresBeforeDown: r.failures_before_down,
          lastPolledAt: r.last_polled_at
        })
      );

      return Result.ok(entities);
    } catch (error) {
      return Result.fail(
        `Database error finding due polling configs: ${(error as Error).message}`
      );
    }
  }

  async save(
    entity: PollingConfiguration
  ): Promise<Result<PollingConfiguration>> {
    try {
      const data = PollingConfigurationMapper.toPersistence(entity);

      await this.prisma.pollingConfiguration.upsert({
        where: { deviceId: data.deviceId },
        update: {
          ipAddress: data.ipAddress,
          enabled: data.enabled,
          pingIntervalSecs: data.pingIntervalSecs,
          failuresBeforeDown: data.failuresBeforeDown,
          lastPolledAt: data.lastPolledAt
        },
        create: {
          id: data.id,
          deviceId: data.deviceId,
          ipAddress: data.ipAddress,
          enabled: data.enabled,
          pingIntervalSecs: data.pingIntervalSecs,
          failuresBeforeDown: data.failuresBeforeDown,
          lastPolledAt: data.lastPolledAt
        }
      });

      return Result.ok(entity);
    } catch (error) {
      return Result.fail(
        `Database error saving polling config: ${(error as Error).message}`
      );
    }
  }

  async delete(deviceId: DeviceId): Promise<Result<void>> {
    try {
      await this.prisma.pollingConfiguration.delete({
        where: { deviceId: deviceId.toString() }
      });
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        `Database error deleting polling config: ${(error as Error).message}`
      );
    }
  }
}
