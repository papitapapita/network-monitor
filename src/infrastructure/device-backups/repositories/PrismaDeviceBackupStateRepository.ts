import { PrismaClient } from 'generated/prisma/client';
import { EventDispatcher, Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  DeviceBackupState,
  IDeviceBackupStateRepository
} from 'domain/device-backups';
import { ConfigBackupPrismaMapper } from '../mappers';

export class PrismaDeviceBackupStateRepository
  implements IDeviceBackupStateRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByDevice(
    deviceId: DeviceId
  ): Promise<Result<DeviceBackupState | null>> {
    try {
      const raw = await this.prisma.deviceBackupState.findUnique({
        where: { deviceId: deviceId.toString() }
      });
      return raw
        ? ConfigBackupPrismaMapper.stateToDomain(raw)
        : Result.ok(null);
    } catch (error) {
      return Result.fail(
        `Database error finding device backup state: ${(error as Error).message}`
      );
    }
  }

  async save(state: DeviceBackupState): Promise<Result<void>> {
    try {
      const data = ConfigBackupPrismaMapper.stateToPersistence(state);
      EventDispatcher.markAggregateForDispatch(state);
      await this.prisma.deviceBackupState.upsert({
        where: { deviceId: data.deviceId },
        update: data,
        create: data
      });
      EventDispatcher.dispatchEventsForAggregate(state.id);
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving device backup state: ${(error as Error).message}`
      );
    }
  }
}
