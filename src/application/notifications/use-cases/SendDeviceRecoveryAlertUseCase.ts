import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { formatDuration } from 'domain/shared/utils';
import { Alert } from 'domain/notifications/aggregates';
import { IAlertRepository } from 'domain/notifications/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import {
  ILogger,
  IAlertPublisher,
  AlertNotification,
  isSuppressedPublish
} from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import { OutageMessages, OutageRollup } from '../shared';
import {
  AffectedDeviceDTO,
  AlertResponseDTO,
  SendDeviceRecoveryAlertDTO
} from '../dtos';

const SOURCE = 'Disponibilidad';
const ALERT_TYPE = 'device_unreachable';

export class SendDeviceRecoveryAlertUseCase extends UseCase<
  SendDeviceRecoveryAlertDTO,
  AlertResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly deviceRepository: IDeviceRepository,
    private readonly alertPublisher: IAlertPublisher,
    logger: ILogger,
    private readonly outageRollup?: OutageRollup,
    // Records in the inbox without telling anyone (NOT-270).
    private readonly inboxOnlyPublisher?: IAlertPublisher
  ) {
    super(logger, 'SendDeviceRecoveryAlertUseCase');
  }

  protected async beforeExecute(
    request: SendDeviceRecoveryAlertDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: SendDeviceRecoveryAlertDTO
  ): Promise<Result<AlertResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const existingResult =
      await this.alertRepository.findOpenByDeviceAndType(
        deviceId,
        ALERT_TYPE
      );
    if (existingResult.isFailure) {
      return this.fail(
        `Failed to load open alert: ${existingResult.error}`
      );
    }

    const openAlert = existingResult.value;
    if (openAlert === null) {
      this.logger.warn(
        'No open alert found for recovered device — skipping recovery notification',
        { deviceId: deviceId.toString() }
      );
      return this.fail(
        'No open alert found for device — recovery skipped'
      );
    }

    const resolveResult = openAlert.resolve(request.occurredAt);
    if (resolveResult.isFailure) {
      return this.fail(resolveResult.error);
    }

    // A blip that self-resolved inside the alert delay was recorded
    // (NOT-097) but never notified — nobody was told it started, so nobody
    // needs to be told it ended. Resolve the record and stop there. A device
    // that went down behind its upstream is never notified either, so it
    // lands here too (NOT-246).
    if (openAlert.notifiedAt === null) {
      const saveResult = await this.alertRepository.save(openAlert);
      if (saveResult.isFailure) {
        return this.fail(`Failed to save alert: ${saveResult.error}`);
      }
      // An outage held back by quiet hours or a mute still reached the
      // inbox, so its recovery goes there too (NOT-270).
      if (this.inboxOnlyPublisher !== undefined) {
        await this.inboxOnlyPublisher.publish(
          await this.recoveryNotice(openAlert, deviceId, request)
        );
      }
      return this.ok(AlertMapper.toDTO(saveResult.value));
    }

    const publishResult = await this.alertPublisher.publish(
      await this.recoveryNotice(openAlert, deviceId, request)
    );

    if (publishResult.isFailure) {
      // Deliberately not retried on a later cycle: unlike the down alert,
      // there is no unnotified-record scan for a resolved alert, and
      // re-announcing a recovery hours later has no value.
      if (!isSuppressedPublish(publishResult.error)) {
        this.logger.error(
          'Failed to publish device-recovery alert notification',
          undefined,
          {
            deviceId: deviceId.toString(),
            error: publishResult.error
          }
        );
      }
    } else {
      openAlert.markRecoveryNotified();
    }

    const saveResult = await this.alertRepository.save(openAlert);
    if (saveResult.isFailure) {
      return this.fail(`Failed to save alert: ${saveResult.error}`);
    }

    return this.ok(AlertMapper.toDTO(saveResult.value));
  }

  private async recoveryNotice(
    openAlert: Alert,
    deviceId: DeviceId,
    request: SendDeviceRecoveryAlertDTO
  ): Promise<AlertNotification> {
    const deviceName = await this.resolveDeviceName(deviceId);
    const summary =
      openAlert.durationSecs === null
        ? `${deviceName} volvió a responder`
        : `${deviceName} volvió a responder tras ${formatDuration(openAlert.durationSecs)} sin conexión`;
    const latency =
      request.latencyMs !== null ? `${request.latencyMs} ms` : 'N/A';
    const affected = await this.affectedDevices(openAlert);

    return {
      deviceId: deviceId.toString(),
      severity: openAlert.severity,
      source: SOURCE,
      summary,
      detail: [
        `Latencia: ${latency}`,
        OutageMessages.recoveryChat(affected)
      ]
        .filter((part) => part !== null)
        .join('\n'),
      shortDetail: OutageMessages.recoveryPush(affected),
      occurredAt: request.occurredAt,
      resolved: true,
      type: ALERT_TYPE,
      alertId: openAlert.id.toString()
    };
  }

  // NOT-245: who came back with this device and who is still down. The
  // ones still down stay attached until their own delay has passed since
  // this recovery — RaiseOverdueDeviceDownAlertsUseCase lets them go.
  private async affectedDevices(
    alert: Alert
  ): Promise<AffectedDeviceDTO[]> {
    if (this.outageRollup === undefined) return [];
    const result = await this.outageRollup.affected(alert);
    if (result.isFailure) {
      this.logger.warn(
        'Could not list the devices behind a recovered alert',
        { alertId: alert.id.toString(), error: result.error }
      );
      return [];
    }
    return result.value;
  }

  private async resolveDeviceName(
    deviceId: DeviceId
  ): Promise<string> {
    try {
      const result = await this.deviceRepository.findById(deviceId);
      if (result.isSuccess && result.value) {
        return result.value.name.value;
      }
    } catch {
      // fallback
    }
    return 'El dispositivo';
  }
}
