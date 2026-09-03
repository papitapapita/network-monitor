import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceNotificationPolicy } from 'domain/notifications/entities';
import { IDeviceNotificationPolicyRepository } from 'domain/notifications/repository';
import { DeviceNotificationPolicyMapper } from '../mappers';

export class PrismaDeviceNotificationPolicyRepository
  implements IDeviceNotificationPolicyRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceNotificationPolicy | null>> {
    try {
      const record =
        await this.prisma.deviceNotificationPolicy.findUnique({
          where: { deviceId: deviceId.toString() }
        });

      if (!record) return Result.ok(null);

      return Result.ok(
        DeviceNotificationPolicyMapper.toDomain(record)
      );
    } catch (error) {
      return Result.fail(
        `Database error finding notification policy: ${(error as Error).message}`
      );
    }
  }

  async save(
    entity: DeviceNotificationPolicy
  ): Promise<Result<DeviceNotificationPolicy>> {
    try {
      const data =
        DeviceNotificationPolicyMapper.toPersistence(entity);

      await this.prisma.deviceNotificationPolicy.upsert({
        where: { deviceId: data.deviceId },
        update: {
          quietHoursStart: data.quietHoursStart,
          quietHoursEnd: data.quietHoursEnd,
          alertDelayMinutes: data.alertDelayMinutes
        },
        create: {
          id: data.id,
          deviceId: data.deviceId,
          quietHoursStart: data.quietHoursStart,
          quietHoursEnd: data.quietHoursEnd,
          alertDelayMinutes: data.alertDelayMinutes
        }
      });

      return Result.ok(entity);
    } catch (error) {
      return Result.fail(
        `Database error saving notification policy: ${(error as Error).message}`
      );
    }
  }

  // deleteMany rather than delete: resetting a device that never had a
  // policy row is a no-op, not a not-found error.
  async delete(deviceId: DeviceId): Promise<Result<void>> {
    try {
      await this.prisma.deviceNotificationPolicy.deleteMany({
        where: { deviceId: deviceId.toString() }
      });
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        `Database error deleting notification policy: ${(error as Error).message}`
      );
    }
  }
}
