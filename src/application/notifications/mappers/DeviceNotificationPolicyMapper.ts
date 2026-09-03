import { DeviceNotificationPolicy } from 'domain/notifications/entities';
import { DeviceNotificationPolicyResponseDTO } from '../dtos';

export class DeviceNotificationPolicyMapper {
  public static toDTO(
    policy: DeviceNotificationPolicy
  ): DeviceNotificationPolicyResponseDTO {
    return {
      deviceId: policy.deviceId.toString(),
      quietHoursStart: policy.quietHours?.start.toString() ?? null,
      quietHoursEnd: policy.quietHours?.end.toString() ?? null,
      alertDelayMinutes: policy.alertDelayMinutes,
      updatedAt: policy.updatedAt.toISOString()
    };
  }

  public static toDefaultDTO(
    deviceId: string
  ): DeviceNotificationPolicyResponseDTO {
    return {
      deviceId,
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: null,
      updatedAt: null
    };
  }
}
