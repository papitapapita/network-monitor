import { Result } from 'domain/shared/core';
import { INotificationSettingsRepository } from 'domain/notifications/repository';
import {
  IAlertPublisher,
  AlertNotification,
  WIRELESS_ALERTS_OFF_SUPPRESSED,
  ILogger
} from 'application/shared/interfaces';

// Wraps the publisher wireless alerts go through, so the administrator's
// on/off switch (NOT-203) applies from the next alert without a restart. The
// alert record is untouched: it stays visible and unnotified, as with quiet
// hours.
export class SwitchedOffAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly inner: IAlertPublisher,
    private readonly settingsRepository: INotificationSettingsRepository,
    private readonly logger: ILogger
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const settings = await this.settingsRepository.get();
    if (settings.isFailure) {
      this.logger.error(
        'SwitchedOffAlertPublisher: failed to read notification settings, notifying anyway',
        undefined,
        { type: notification.type, error: settings.error }
      );
    } else if (!settings.value.wirelessAlertsEnabled) {
      return Result.fail(WIRELESS_ALERTS_OFF_SUPPRESSED);
    }

    return this.inner.publish(notification);
  }
}
