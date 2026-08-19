import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { WirelessAlertClearedEvent } from 'domain/wireless-monitoring/events';
import {
  ILogger,
  IAlertPublisher
} from 'application/shared/interfaces';

const SOURCE = 'Enlace inalámbrico';

export class WirelessAlertClearedNotificationHandler
  implements IHandle<WirelessAlertClearedEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: WirelessAlertClearedEvent): Promise<void> {
    // Only CRITICAL recoveries are announced. No CRITICAL rule is a
    // change-detection rule, so this also excludes the tautological clears
    // those emit — their breach condition always resolves on the next poll.
    if (event.severity !== 'CRITICAL') return;

    try {
      const result = await this.alertPublisher.publish({
        deviceId: event.deviceId.toString(),
        severity: AlertSeverity.CRITICAL,
        source: SOURCE,
        subject: event.metric,
        detail: `La condición de alerta en ${event.metric} se ha normalizado.`,
        occurredAt: event.clearedAt,
        resolved: true
      });

      if (result.isFailure) {
        this.logger.error(
          'WirelessAlertClearedNotificationHandler: publish failed',
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
