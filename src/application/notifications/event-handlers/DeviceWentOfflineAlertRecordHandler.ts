import { IHandle } from 'domain/shared/interfaces';
import { DeviceWentOfflineEvent } from 'domain/device-monitoring/events';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { DeviceId } from 'domain/shared/ids';
import { ILogger, IAlertRecorder } from 'application/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';

const SOURCE = 'Disponibilidad';
const ALERT_TYPE = 'device_unreachable';

// Records every device-down transition into the shared alert store the
// instant it happens (NOT-097) — independent of whether the outage ever
// outlives the notification delay. Ticketing is deliberately skipped here:
// it opens later, from SendDeviceDownAlertUseCase, only once the alert is
// actually notified, so a blip that self-resolves never opens a work order.
export class DeviceWentOfflineAlertRecordHandler
  implements IHandle<DeviceWentOfflineEvent>
{
  constructor(
    private readonly recorder: IAlertRecorder,
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly logger: ILogger
  ) {}

  async handle(event: DeviceWentOfflineEvent): Promise<void> {
    const deviceId = event.aggregateId.toString();

    try {
      const ipAddress = await this.resolveIpAddress(
        event.aggregateId
      );

      const result = await this.recorder.open({
        deviceId,
        severity: AlertSeverity.CRITICAL,
        source: SOURCE,
        type: ALERT_TYPE,
        description: this.buildDetail(ipAddress),
        details: {
          consecutiveFailures: event.consecutiveFailures,
          ipAddress
        },
        skipTicket: true
      });

      if (result.isFailure) {
        this.logger.error(
          'DeviceWentOfflineAlertRecordHandler: open failed',
          undefined,
          { deviceId, error: result.error }
        );
      }
    } catch (error) {
      this.logger.error(
        'DeviceWentOfflineAlertRecordHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        { deviceId }
      );
    }
  }

  private async resolveIpAddress(
    deviceId: DeviceId
  ): Promise<string | null> {
    try {
      const result =
        await this.pollingConfigRepo.findByDeviceId(deviceId);
      if (result.isSuccess && result.value?.ipAddress) {
        return result.value.ipAddress.value;
      }
    } catch {
      // fallback
    }
    return null;
  }

  private buildDetail(ipAddress: string | null): string {
    const ip = ipAddress ? ` IP: ${ipAddress}.` : '';
    return `Sin conexión.${ip}`;
  }
}
