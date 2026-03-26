import { PrismaClient, Prisma } from '../../generated/prisma/client';
import { Result } from '../../domain/shared/core';
import { DeviceId } from '../../domain/shared';
import {
  IPingResultRepository,
  PingResultRecord,
  PingResultFilters,
  PingResultPage,
  CreatePingResultInput
} from '../../domain/device-monitoring/repository/IPingResultRepository';

export class PrismaPingResultRepository
  implements IPingResultRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async save(input: CreatePingResultInput): Promise<Result<void>> {
    try {
      await this.prisma.pingResult.create({
        data: {
          deviceId: input.deviceId.toString(),
          isReachable: input.isReachable,
          latencyMs:
            input.latencyMs !== null ? input.latencyMs : null,
          checkedAt: input.checkedAt
        }
      });
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        `save ping result failed: ${(error as Error).message}`
      );
    }
  }

  async findLatestByDevice(
    deviceId: DeviceId,
    limit: number
  ): Promise<Result<PingResultRecord[]>> {
    try {
      const records = await this.prisma.pingResult.findMany({
        where: { deviceId: deviceId.toString() },
        orderBy: { checkedAt: 'desc' },
        take: limit
      });

      return Result.ok(records.map((r) => this.toRecord(r)));
    } catch (error) {
      return Result.fail(
        `findLatestByDevice failed: ${(error as Error).message}`
      );
    }
  }

  async findByDevice(
    deviceId: DeviceId,
    filters: PingResultFilters
  ): Promise<Result<PingResultPage>> {
    try {
      const where: Prisma.PingResultWhereInput = {
        deviceId: deviceId.toString()
      };

      if (filters.isReachable !== undefined) {
        where.isReachable = filters.isReachable;
      }

      if (filters.fromDate || filters.toDate) {
        where.checkedAt = {
          ...(filters.fromDate && { gte: filters.fromDate }),
          ...(filters.toDate && { lte: filters.toDate })
        };
      }

      const [rows, total] = await this.prisma.$transaction([
        this.prisma.pingResult.findMany({
          where,
          orderBy: { checkedAt: 'desc' },
          skip: filters.offset,
          take: filters.limit
        }),
        this.prisma.pingResult.count({ where })
      ]);

      return Result.ok({
        records: rows.map((r) => this.toRecord(r)),
        total
      });
    } catch (error) {
      return Result.fail(
        `findByDevice failed: ${(error as Error).message}`
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private toRecord(raw: {
    id: string;
    deviceId: string;
    isReachable: boolean;
    latencyMs: unknown;
    checkedAt: Date;
  }): PingResultRecord {
    const deviceIdResult = DeviceId.parse(raw.deviceId);
    if (deviceIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid deviceId "${raw.deviceId}" in ping_results`
      );
    }

    return {
      id: raw.id,
      deviceId: deviceIdResult.value,
      isReachable: raw.isReachable,
      latencyMs:
        raw.latencyMs !== null ? Number(raw.latencyMs) : null,
      checkedAt: raw.checkedAt
    };
  }
}
