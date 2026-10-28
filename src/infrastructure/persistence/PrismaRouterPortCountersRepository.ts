import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { RouterPortCounters } from 'domain/device-monitoring/aggregates';
import { IRouterPortCountersRepository } from 'domain/device-monitoring/repository';
import {
  PrismaPortCounterRecord,
  RouterPortCountersMapper
} from '../mappers';
import { isForeignKeyViolation } from './prisma-errors';

export class PrismaRouterPortCountersRepository
  implements IRouterPortCountersRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async listForDevices(
    deviceIds: DeviceId[]
  ): Promise<Result<RouterPortCounters[]>> {
    try {
      const records = await this.prisma.portCounter.findMany({
        where: {
          deviceId: { in: deviceIds.map((id) => id.toString()) }
        },
        orderBy: [{ deviceId: 'asc' }, { portName: 'asc' }]
      });
      const byDevice = new Map<string, PrismaPortCounterRecord[]>();
      for (const record of records) {
        byDevice.set(record.deviceId, [
          ...(byDevice.get(record.deviceId) ?? []),
          record
        ]);
      }
      return Result.ok(
        [...byDevice].map(([deviceId, rows]) =>
          RouterPortCountersMapper.toDomain(deviceId, rows)
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error listing port counters: ${(error as Error).message}`
      );
    }
  }

  // One router at a time: a router deleted mid-check fails its own insert on
  // the foreign key and is skipped, the others are still saved.
  async saveAll(
    counters: RouterPortCounters[]
  ): Promise<Result<void>> {
    try {
      for (const router of counters) {
        await this.prisma
          .$transaction([
            this.prisma.portCounter.deleteMany({
              where: { deviceId: router.deviceId.toString() }
            }),
            this.prisma.portCounter.createMany({
              data: RouterPortCountersMapper.toPersistence(router)
            })
          ])
          .catch((error: unknown) => {
            if (!isForeignKeyViolation(error)) throw error;
          });
      }
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving port counters: ${(error as Error).message}`
      );
    }
  }
}
