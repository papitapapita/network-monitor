import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { PingResultRecord } from 'domain/device-monitoring/repository';
import {
  IPollingStatusListQuery,
  PollingStatusRow
} from 'application/device-monitoring/interfaces';
import {
  DeviceStateMapper,
  PollingConfigurationMapper
} from '../mappers';

type LatestPingRow = {
  id: string;
  device_id: string;
  is_reachable: boolean;
  latency_ms: unknown;
  checked_at: Date;
};

export class PrismaPollingStatusListQuery
  implements IPollingStatusListQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async listAll(): Promise<Result<PollingStatusRow[]>> {
    try {
      const configs = await this.prisma.pollingConfiguration.findMany(
        {
          where: { device: { deletedAt: null } },
          include: { device: { select: { deviceState: true } } },
          orderBy: { deviceId: 'asc' }
        }
      );
      if (configs.length === 0) return Result.ok([]);

      const latestPings = await this.findLatestPings(
        configs.map((c) => c.deviceId)
      );

      return Result.ok(
        configs.map(({ device, ...config }) => ({
          config: PollingConfigurationMapper.toDomain(config),
          state: device.deviceState
            ? DeviceStateMapper.toDomain(device.deviceState)
            : null,
          lastPing: latestPings.get(config.deviceId) ?? null
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error listing polling statuses: ${(error as Error).message}`
      );
    }
  }

  // One index probe per device on (device_id, checked_at DESC): DISTINCT ON
  // would read every row of the 30-day history instead.
  private async findLatestPings(
    deviceIds: string[]
  ): Promise<Map<string, PingResultRecord>> {
    const rows = await this.prisma.$queryRaw<LatestPingRow[]>`
      SELECT pr.id, pr.device_id, pr.is_reachable, pr.latency_ms,
             pr.checked_at
      FROM unnest(${deviceIds}::uuid[]) AS d(id)
      CROSS JOIN LATERAL (
        SELECT id, device_id, is_reachable, latency_ms, checked_at
        FROM ping_results
        WHERE device_id = d.id
        ORDER BY checked_at DESC
        LIMIT 1
      ) pr
    `;

    return new Map(
      rows.map((row) => [row.device_id, this.toRecord(row)])
    );
  }

  private toRecord(row: LatestPingRow): PingResultRecord {
    const deviceIdResult = DeviceId.parse(row.device_id);
    if (deviceIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid deviceId "${row.device_id}" in ping_results`
      );
    }
    return {
      id: row.id,
      deviceId: deviceIdResult.value,
      isReachable: row.is_reachable,
      latencyMs:
        row.latency_ms !== null ? Number(row.latency_ms) : null,
      checkedAt: row.checked_at
    };
  }
}
