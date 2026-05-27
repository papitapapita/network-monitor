import { PrismaClient } from 'generated/prisma/client';
import { Result, EventDispatcher } from 'domain/shared/core';
import { WirelessAlertRecordId, DeviceId } from 'domain/shared/ids';
import { IWirelessAlertRecordRepository } from 'domain/wireless-monitoring/repository';
import { WirelessAlertRecord } from 'domain/wireless-monitoring/aggregates';
import { WirelessAlertRecordPrismaMapper } from '../mappers';

export class PrismaWirelessAlertRecordRepository
  implements IWirelessAlertRecordRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async save(
    record: WirelessAlertRecord
  ): Promise<Result<WirelessAlertRecord>> {
    try {
      const data =
        WirelessAlertRecordPrismaMapper.toPersistence(record);
      EventDispatcher.markAggregateForDispatch(record);

      await this.prisma.wirelessAlertRecord.upsert({
        where: { id: data.id },
        update: {
          severity: data.severity as 'WARNING' | 'CRITICAL',
          threshold: data.threshold,
          clearedAt: data.clearedAt,
          isActive: data.isActive,
          lastValue: data.lastValue,
          message: data.message
        },
        create: {
          id: data.id,
          deviceId: data.deviceId,
          metric: data.metric,
          severity: data.severity as 'WARNING' | 'CRITICAL',
          threshold: data.threshold,
          triggeredAt: data.triggeredAt,
          clearedAt: data.clearedAt,
          isActive: data.isActive,
          lastValue: data.lastValue,
          message: data.message
        }
      });

      EventDispatcher.dispatchEventsForAggregate(record.id);
      return Result.ok(record);
    } catch (error) {
      return Result.fail(
        `Database error saving wireless alert record: ${(error as Error).message}`
      );
    }
  }

  async findActiveByDeviceAndMetric(
    deviceId: DeviceId,
    metric: string
  ): Promise<Result<WirelessAlertRecord | null>> {
    try {
      const raw = await this.prisma.wirelessAlertRecord.findFirst({
        where: {
          deviceId: deviceId.toString(),
          metric,
          isActive: true
        }
      });
      if (!raw) return Result.ok(null);
      return Result.ok(
        WirelessAlertRecordPrismaMapper.toDomain(
          raw as Parameters<
            typeof WirelessAlertRecordPrismaMapper.toDomain
          >[0]
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding active alert record: ${(error as Error).message}`
      );
    }
  }

  async findAllActiveByDevice(
    deviceId: DeviceId
  ): Promise<Result<WirelessAlertRecord[]>> {
    try {
      const raws = await this.prisma.wirelessAlertRecord.findMany({
        where: { deviceId: deviceId.toString(), isActive: true },
        orderBy: { triggeredAt: 'desc' }
      });
      return Result.ok(
        raws.map((r) =>
          WirelessAlertRecordPrismaMapper.toDomain(
            r as Parameters<
              typeof WirelessAlertRecordPrismaMapper.toDomain
            >[0]
          )
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding active alerts by device: ${(error as Error).message}`
      );
    }
  }

  async findAllActive(): Promise<Result<WirelessAlertRecord[]>> {
    try {
      const raws = await this.prisma.wirelessAlertRecord.findMany({
        where: { isActive: true },
        orderBy: { triggeredAt: 'desc' }
      });
      return Result.ok(
        raws.map((r) =>
          WirelessAlertRecordPrismaMapper.toDomain(
            r as Parameters<
              typeof WirelessAlertRecordPrismaMapper.toDomain
            >[0]
          )
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding all active alerts: ${(error as Error).message}`
      );
    }
  }

  async findById(
    id: WirelessAlertRecordId
  ): Promise<Result<WirelessAlertRecord | null>> {
    try {
      const raw = await this.prisma.wirelessAlertRecord.findUnique({
        where: { id: id.toString() }
      });
      if (!raw) return Result.ok(null);
      return Result.ok(
        WirelessAlertRecordPrismaMapper.toDomain(
          raw as Parameters<
            typeof WirelessAlertRecordPrismaMapper.toDomain
          >[0]
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding wireless alert record: ${(error as Error).message}`
      );
    }
  }

  async exists(id: WirelessAlertRecordId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.wirelessAlertRecord.count({
        where: { id: id.toString() }
      });
      return Result.ok(count > 0);
    } catch (error) {
      return Result.fail(
        `Database error checking wireless alert record existence: ${(error as Error).message}`
      );
    }
  }

  async findHistoryByDevice(
    deviceId: DeviceId,
    from: Date,
    to: Date,
    limit?: number
  ): Promise<Result<WirelessAlertRecord[]>> {
    try {
      const raws = await this.prisma.wirelessAlertRecord.findMany({
        where: {
          deviceId: deviceId.toString(),
          triggeredAt: { gte: from, lte: to }
        },
        orderBy: { triggeredAt: 'desc' },
        ...(limit !== undefined ? { take: limit } : {})
      });
      return Result.ok(
        raws.map((r) =>
          WirelessAlertRecordPrismaMapper.toDomain(
            r as Parameters<
              typeof WirelessAlertRecordPrismaMapper.toDomain
            >[0]
          )
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding alert history: ${(error as Error).message}`
      );
    }
  }
}
