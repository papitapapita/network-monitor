import { IHandle } from 'domain/shared/interfaces';
import { WirelessAlertClearedEvent } from 'domain/wireless-monitoring/events';
import { ILogger } from 'application/shared/interfaces';
import { IWirelessAlertNotifier } from '../interfaces';

export class WirelessAlertClearedNotificationHandler
  implements IHandle<WirelessAlertClearedEvent>
{
  constructor(
    private readonly notifier: IWirelessAlertNotifier,
    private readonly logger: ILogger
  ) {}

  async handle(event: WirelessAlertClearedEvent): Promise<void> {
    // Only CRITICAL recoveries are announced. No CRITICAL rule is a
    // change-detection rule, so this also excludes the tautological clears
    // those emit — their breach condition always resolves on the next poll.
    if (event.severity !== 'CRITICAL') return;

    try {
      const result = await this.notifier.notifyCleared({
        deviceId: event.deviceId.toString(),
        metric: event.metric,
        severity: event.severity,
        clearedAt: event.clearedAt
      });

      if (result.isFailure) {
        this.logger.error(
          'WirelessAlertClearedNotificationHandler: notifier failed',
          undefined,
          { metric: event.metric, error: result.error }
        );
      }
    } catch (error) {
      this.logger.error(
        'WirelessAlertClearedNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        { metric: event.metric }
      );
    }
  }
}
