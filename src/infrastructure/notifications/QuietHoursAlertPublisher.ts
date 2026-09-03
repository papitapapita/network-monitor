import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceNotificationPolicyRepository } from 'domain/notifications/repository';
import {
  IAlertPublisher,
  AlertNotification,
  QUIET_HOURS_SUPPRESSED,
  ILogger
} from 'application/shared/interfaces';

// Decorates the real publisher so every alert-producing path (device down,
// device recovery, wireless open/cleared alerts — they all share one
// IAlertPublisher instance, see container.ts) gets quiet-hours suppression
// for free, with no change to any of those call sites.
export class QuietHoursAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly inner: IAlertPublisher,
    private readonly policyRepository: IDeviceNotificationPolicyRepository,
    private readonly logger: ILogger
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(notification.deviceId);
    if (deviceIdResult.isSuccess) {
      const policyResult = await this.policyRepository.findByDeviceId(
        deviceIdResult.value
      );
      if (policyResult.isFailure) {
        this.logger.error(
          'QuietHoursAlertPublisher: failed to load notification policy, notifying anyway',
          undefined,
          {
            deviceId: notification.deviceId,
            error: policyResult.error
          }
        );
      } else if (policyResult.value?.isWithinQuietHours(new Date())) {
        return Result.fail(QUIET_HOURS_SUPPRESSED);
      }
    }

    return this.inner.publish(notification);
  }
}
