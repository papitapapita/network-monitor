import { PrismaClient, Prisma } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IPingResultRepository,
  PingResultRecord,
  PingResultFilters,
  PingResultPage,
  PingResultStats,
  PingResultWindow,
  CreatePingResultInput
} from 'domain/device-monitoring/repository';

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

  async saveOnce(
    input: CreatePingResultInput & { sourceResultId: string }
  ): Promise<Result<boolean>> {
    try {
      const { count } = await this.prisma.pingResult.createMany({
        data: [
          {
            deviceId: input.deviceId.toString(),
            isReachable: input.isReachable,
            latencyMs: input.latencyMs,
            checkedAt: input.checkedAt,
            sourceResultId: input.sourceResultId
          }
        ],
        skipDuplicates: true
      });
      return Result.ok(count === 1);
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
      const where = this.windowWhere(deviceId, filters);

      if (filters.isReachable !== undefined) {
        where.isReachable = filters.isReachable;
      }

      const sortOrder = filters.sortOrder === 'ASC' ? 'asc' : 'desc';
      const orderBy: Prisma.PingResultOrderByWithRelationInput = {
        [filters.sortBy ?? 'checkedAt']: sortOrder
      };

      const [rows, total] = await this.prisma.$transaction([
        this.prisma.pingResult.findMany({
          where,
          orderBy,
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

  async statsByDevice(
    deviceId: DeviceId,
    window: PingResultWindow
  ): Promise<Result<PingResultStats>> {
    try {
      const where = this.windowWhere(deviceId, window);

      const [total, reachable] = await this.prisma.$transaction([
        this.prisma.pingResult.count({ where }),
        this.prisma.pingResult.aggregate({
          where: { ...where, isReachable: true },
          _count: { _all: true },
          _avg: { latencyMs: true },
          _min: { latencyMs: true },
          _max: { latencyMs: true }
        })
      ]);

      return Result.ok({
        total,
        reachable: reachable._count._all,
        averageLatencyMs: this.toNumber(reachable._avg.latencyMs),
        minLatencyMs: this.toNumber(reachable._min.latencyMs),
        maxLatencyMs: this.toNumber(reachable._max.latencyMs)
      });
    } catch (error) {
      return Result.fail(
        `statsByDevice failed: ${(error as Error).message}`
      );
    }
  }

  async deleteOlderThan(cutoff: Date): Promise<Result<number>> {
    try {
      const { count } = await this.prisma.pingResult.deleteMany({
        where: { checkedAt: { lt: cutoff } }
      });
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `deleteOlderThan failed: ${(error as Error).message}`
      );
    }
  }

  async deleteByDevice(
    deviceId: DeviceId,
    filters: { fromDate?: Date; toDate?: Date }
  ): Promise<Result<number>> {
    try {
      const where = this.windowWhere(deviceId, filters);

      const { count } = await this.prisma.pingResult.deleteMany({
        where
      });
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `deleteByDevice failed: ${(error as Error).message}`
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private windowWhere(
    deviceId: DeviceId,
    window: PingResultWindow
  ): Prisma.PingResultWhereInput {
    const where: Prisma.PingResultWhereInput = {
      deviceId: deviceId.toString()
    };

    if (window.fromDate || window.toDate) {
      where.checkedAt = {
        ...(window.fromDate && { gte: window.fromDate }),
        ...(window.toDate && { lte: window.toDate })
      };
    }

    return where;
  }

  private toNumber(value: unknown): number | null {
    return value === null || value === undefined
      ? null
      : Number(value);
  }

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
