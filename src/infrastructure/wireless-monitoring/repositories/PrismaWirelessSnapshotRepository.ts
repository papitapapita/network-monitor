import { PrismaClient } from 'generated/prisma/client';
import { Result, EventDispatcher } from 'domain/shared/core';
import { DeviceId, SnapshotId } from 'domain/shared/ids';
import { IWirelessSnapshotRepository } from 'domain/wireless-monitoring/repository';
import { WirelessSnapshot } from 'domain/wireless-monitoring/aggregates';
import { WirelessSnapshotPrismaMapper } from '../mappers/';

export class PrismaWirelessSnapshotRepository
  implements IWirelessSnapshotRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async save(
    snapshot: WirelessSnapshot
  ): Promise<Result<WirelessSnapshot>> {
    try {
      const data =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);
      EventDispatcher.markAggregateForDispatch(snapshot);

      await this.prisma.wirelessSnapshot.create({
        data: data as Parameters<
          typeof this.prisma.wirelessSnapshot.create
        >[0]['data']
      });

      EventDispatcher.dispatchEventsForAggregate(snapshot.id);
      return Result.ok(snapshot);
    } catch (error) {
      return Result.fail(
        `Database error saving wireless snapshot: ${(error as Error).message}`
      );
    }
  }

  async findById(
    id: SnapshotId
  ): Promise<Result<WirelessSnapshot | null>> {
    try {
      const raw = await this.prisma.wirelessSnapshot.findUnique({
        where: { id: id.toString() }
      });
      if (!raw) return Result.ok(null);
      // Prisma return type is broader than the mapper's narrowed type — cast required
      return Result.ok(
        WirelessSnapshotPrismaMapper.toDomain(
          raw as unknown as Parameters<
            typeof WirelessSnapshotPrismaMapper.toDomain
          >[0]
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding wireless snapshot by id: ${(error as Error).message}`
      );
    }
  }

  async findLatestByDevice(
    deviceId: DeviceId
  ): Promise<Result<WirelessSnapshot | null>> {
    try {
      const raw = await this.prisma.wirelessSnapshot.findFirst({
        where: { deviceId: deviceId.toString() },
        orderBy: { collectedAt: 'desc' }
      });
      if (!raw) return Result.ok(null);
      return Result.ok(
        WirelessSnapshotPrismaMapper.toDomain(
          raw as unknown as Parameters<
            typeof WirelessSnapshotPrismaMapper.toDomain
          >[0]
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding wireless snapshot: ${(error as Error).message}`
      );
    }
  }

  async findHistoryByDevice(
    deviceId: DeviceId,
    from: Date,
    to: Date
  ): Promise<Result<WirelessSnapshot[]>> {
    try {
      const raws = await this.prisma.wirelessSnapshot.findMany({
        where: {
          deviceId: deviceId.toString(),
          collectedAt: { gte: from, lte: to }
        },
        orderBy: { collectedAt: 'desc' }
      });
      return Result.ok(
        raws.map((r) =>
          WirelessSnapshotPrismaMapper.toDomain(
            r as unknown as Parameters<
              typeof WirelessSnapshotPrismaMapper.toDomain
            >[0]
          )
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error finding wireless history: ${(error as Error).message}`
      );
    }
  }
}
