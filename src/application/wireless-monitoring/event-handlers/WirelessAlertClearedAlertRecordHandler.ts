import { IHandle } from 'domain/shared/interfaces';
import { WirelessAlertClearedEvent } from 'domain/wireless-monitoring/events';
import {
  ILogger,
  IAlertRecorder
} from 'application/shared/interfaces';

/**
 * Resolves the corresponding alert in the shared alert store when a wireless
 * condition clears, keeping the unified alert list in sync. Idempotent.
 */
export class WirelessAlertClearedAlertRecordHandler
  implements IHandle<WirelessAlertClearedEvent>
{
  constructor(
    private readonly recorder: IAlertRecorder,
    private readonly logger: ILogger
  ) {}

  async handle(event: WirelessAlertClearedEvent): Promise<void> {
    try {
      const result = await this.recorder.resolve(
        event.deviceId.toString(),
        `wireless:${event.metric}:${event.severity}`,
        event.clearedAt
      );

      if (result.isFailure) {
        this.logger.error(
          'WirelessAlertClearedAlertRecordHandler: resolve failed',
          undefined,
          { metric: event.metric, error: result.error }
        );
      }
    } catch (error) {
      this.logger.error(
        'WirelessAlertClearedAlertRecordHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        { metric: event.metric }
      );
    }
  }
}
