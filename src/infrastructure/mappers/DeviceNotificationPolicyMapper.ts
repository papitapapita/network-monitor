import {
  DeviceId,
  DeviceNotificationPolicyId
} from 'domain/shared/ids';
import { DeviceNotificationPolicy } from 'domain/notifications/entities';
import {
  QuietHours,
  TimeOfDay
} from 'domain/notifications/value-objects';

type PrismaDeviceNotificationPolicyRecord = {
  id: string;
  deviceId: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export class DeviceNotificationPolicyMapper {
  public static toDomain(
    raw: PrismaDeviceNotificationPolicyRecord
  ): DeviceNotificationPolicy {
    const deviceIdResult = DeviceId.parse(raw.deviceId);
    if (deviceIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid deviceId "${raw.deviceId}" in device_notification_policies`
      );
    }

    const policyIdResult = DeviceNotificationPolicyId.parse(raw.id);
    if (policyIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id "${raw.id}" in device_notification_policies`
      );
    }

    let quietHours: QuietHours | null = null;
    if (raw.quietHoursStart !== null && raw.quietHoursEnd !== null) {
      const startResult = TimeOfDay.create(raw.quietHoursStart);
      const endResult = TimeOfDay.create(raw.quietHoursEnd);
      if (startResult.isFailure || endResult.isFailure) {
        throw new Error(
          `Data integrity violation: invalid quiet hours "${raw.quietHoursStart}"-"${raw.quietHoursEnd}" in device_notification_policies`
        );
      }
      quietHours = QuietHours.reconstitute({
        start: startResult.value,
        end: endResult.value
      });
    }

    return DeviceNotificationPolicy.reconstitute(
      policyIdResult.value,
      {
        deviceId: deviceIdResult.value,
        quietHours,
        alertDelayMinutes: raw.alertDelayMinutes,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      }
    );
  }

  public static toPersistence(
    entity: DeviceNotificationPolicy
  ): PrismaDeviceNotificationPolicyRecord {
    return {
      id: entity.id.toString(),
      deviceId: entity.deviceId.toString(),
      quietHoursStart: entity.quietHours?.start.toString() ?? null,
      quietHoursEnd: entity.quietHours?.end.toString() ?? null,
      alertDelayMinutes: entity.alertDelayMinutes,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }
}
