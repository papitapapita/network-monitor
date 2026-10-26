import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { TimeOfDay } from 'domain/shared/value-objects';
import {
  IDeviceNotificationPolicyRepository,
  INotificationSettingsRepository
} from 'domain/notifications/repository';
import { QuietHours } from 'domain/notifications/value-objects';
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
    private readonly settingsRepository: INotificationSettingsRepository,
    private readonly logger: ILogger
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    // Quiet hours are a per-device policy; an alert with no device has none.
    if (notification.deviceId === null) {
      return this.inner.publish(notification);
    }

    const deviceIdResult = DeviceId.parse(notification.deviceId);
    if (deviceIdResult.isSuccess) {
      const window = await this.quietHoursFor(
        deviceIdResult.value,
        notification.deviceId
      );
      if (window?.contains(TimeOfDay.fromDate(new Date()))) {
        return Result.fail(QUIET_HOURS_SUPPRESSED);
      }
    }

    return this.inner.publish(notification);
  }

  // Any failure to load answers "no window": a hiccup in these tables must
  // never swallow a real alert (NOT-174).
  private async quietHoursFor(
    deviceId: DeviceId,
    rawDeviceId: string
  ): Promise<QuietHours | null> {
    const policyResult =
      await this.policyRepository.findByDeviceId(deviceId);
    if (policyResult.isFailure) {
      this.logger.error(
        'QuietHoursAlertPublisher: failed to load notification policy, notifying anyway',
        undefined,
        { deviceId: rawDeviceId, error: policyResult.error }
      );
      return null;
    }

    // No policy row is the same as one that inherits (NOT-170).
    const policy = policyResult.value;
    if (policy && policy.quietHoursMode !== 'INHERIT') {
      return policy.effectiveQuietHours(null);
    }

    const settingsResult = await this.settingsRepository.get();
    if (settingsResult.isFailure) {
      this.logger.error(
        'QuietHoursAlertPublisher: failed to load notification settings, notifying anyway',
        undefined,
        { deviceId: rawDeviceId, error: settingsResult.error }
      );
      return null;
    }
    return settingsResult.value.quietHours;
  }
}
