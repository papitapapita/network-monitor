import { PrismaClient } from '@prisma/client';
import { Result, EventDispatcher } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceStateRepository } from 'domain/device-monitoring/repository';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { DeviceStateMapper } from '../mappers';

export class PrismaDeviceStateRepository
  implements IDeviceStateRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceState | null>> {
    try {
      const record = await this.prisma.deviceState.findUnique({
        where: { deviceId: deviceId.toString() }
      });

      if (!record) return Result.ok(null);

      return Result.ok(DeviceStateMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `findByDeviceId failed: ${(error as Error).message}`
      );
    }
  }

  async save(state: DeviceState): Promise<Result<DeviceState>> {
    try {
      const data = DeviceStateMapper.toPersistence(state);
      EventDispatcher.markAggregateForDispatch(state);

      await this.prisma.deviceState.upsert({
        where: { deviceId: data.deviceId },
        update: { ...data },
        create: { ...data }
      });

      EventDispatcher.dispatchEventsForAggregate(state.id);
      return Result.ok(state);
    } catch (error) {
      return Result.fail(`save failed: ${(error as Error).message}`);
    }
  }
}
