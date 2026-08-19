import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { WirelessAlertTriggeredEvent } from 'domain/wireless-monitoring/events';
import {
  ILogger,
  IAlertRecorder
} from 'application/shared/interfaces';

const SOURCE = 'Enlace inalámbrico';

/**
 * Records each triggered wireless alert into the shared alert store so it
 * surfaces in the unified alert list. Idempotent per (device, type) — the
 * triggered event re-fires every poll with active alerts, which is what makes
 * the record self-heal if a write is ever missed.
 */
export class WirelessAlertTriggeredAlertRecordHandler
  implements IHandle<WirelessAlertTriggeredEvent>
{
  constructor(
    private readonly recorder: IAlertRecorder,
    private readonly logger: ILogger
  ) {}

  async handle(event: WirelessAlertTriggeredEvent): Promise<void> {
    const deviceId = event.deviceId.toString();

    for (const alert of event.alerts) {
      try {
        const result = await this.recorder.open({
          deviceId,
          severity:
            alert.severity === 'CRITICAL'
              ? AlertSeverity.CRITICAL
              : AlertSeverity.WARNING,
          source: SOURCE,
          type: `wireless:${alert.metric}:${alert.severity}`,
          description: alert.message,
          details: {
            metric: alert.metric,
            severity: alert.severity,
            threshold: alert.threshold,
            currentValue: alert.currentValue
          }
        });

        if (result.isFailure) {
          this.logger.error(
            'WirelessAlertTriggeredAlertRecordHandler: open failed',
            undefined,
            { metric: alert.metric, error: result.error }
          );
        }
      } catch (error) {
        this.logger.error(
          'WirelessAlertTriggeredAlertRecordHandler: unexpected error',
          error instanceof Error ? error : new Error(String(error)),
          { metric: alert.metric }
        );
      }
    }
  }
}
