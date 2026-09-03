import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { AlertSeverity } from 'domain/shared/enums';
import { IAlertRepository } from 'domain/notifications/repository';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IDeviceEligibilityService } from 'domain/device-inventory/services';
import { UseCase } from 'application/shared/core';
import {
  ILogger,
  IAlertPublisher
} from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import { AlertResponseDTO, SendDeviceDownAlertDTO } from '../dtos';

const SOURCE = 'Disponibilidad';
const SUBJECT = 'Dispositivo fuera de línea';
const ALERT_TYPE = 'device_unreachable';

export class SendDeviceDownAlertUseCase extends UseCase<
  SendDeviceDownAlertDTO,
  AlertResponseDTO | null
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly pollingConfigRepository: IPollingConfigurationRepository,
    private readonly deviceRepository: IDeviceRepository,
    private readonly eligibility: IDeviceEligibilityService,
    private readonly alertPublisher: IAlertPublisher,
    logger: ILogger
  ) {
    super(logger, 'SendDeviceDownAlertUseCase');
  }

  protected async beforeExecute(
    request: SendDeviceDownAlertDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    if (request.consecutiveFailures < 0) {
      return Result.fail('consecutiveFailures must be >= 0');
    }
    return null;
  }

  protected async executeImpl(
    request: SendDeviceDownAlertDTO
  ): Promise<Result<AlertResponseDTO | null>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const eligible = await this.isDeviceStillAlertable(deviceId);
    if (eligible.isFailure) {
      return this.fail(eligible.error);
    }
    if (!eligible.value) {
      return this.ok(null);
    }

    const existingResult =
      await this.alertRepository.findOpenByDeviceAndType(
        deviceId,
        ALERT_TYPE
      );
    if (existingResult.isFailure) {
      return this.fail(
        `Failed to check existing alerts: ${existingResult.error}`
      );
    }
    if (existingResult.value !== null) {
      return this.ok(AlertMapper.toDTO(existingResult.value));
    }

    const ipAddress = await this.resolveIpAddress(deviceId);
    const detail = this.buildDetail({ ipAddress });

    const alertResult = Alert.open(
      deviceId,
      AlertSeverity.CRITICAL,
      SOURCE,
      ALERT_TYPE,
      detail,
      {
        consecutiveFailures: request.consecutiveFailures,
        ipAddress
      }
    );
    if (alertResult.isFailure) {
      return this.fail(
        `Failed to create alert: ${alertResult.error}`
      );
    }
    const alert = alertResult.value;

    const publishResult = await this.alertPublisher.publish({
      deviceId: deviceId.toString(),
      severity: AlertSeverity.CRITICAL,
      source: SOURCE,
      subject: SUBJECT,
      detail,
      occurredAt: request.occurredAt,
      resolved: false
    });

    if (publishResult.isFailure) {
      this.logger.error(
        'Failed to publish device-down alert notification',
        undefined,
        { deviceId: deviceId.toString(), error: publishResult.error }
      );
    } else {
      alert.markNotified();
    }

    const saveResult = await this.alertRepository.save(alert);

    if (saveResult.isFailure) {
      return this.fail(`Failed to save alert: ${saveResult.error}`);
    }

    return this.ok(AlertMapper.toDTO(saveResult.value));
  }

  // Polling selects devices off a flag an event handler was supposed to have
  // cleared, and dispatch is fire-and-forget — so a poll can still fail for a
  // device that was deleted or retired days ago. Re-reading the aggregate at
  // dispatch time is the check that cannot go stale. Only the opening path is
  // gated; recovery stays open so an alert raised while the device was live
  // can still be resolved.
  private async isDeviceStillAlertable(
    deviceId: DeviceId
  ): Promise<Result<boolean>> {
    const deviceResult =
      await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure) {
      return Result.fail(
        `Failed to load device for alert: ${deviceResult.error}`
      );
    }

    // findById hides soft-deleted rows, so a tombstone arrives as null.
    if (deviceResult.value === null) {
      this.logger.warn(
        'Suppressed a device-down alert for a device that no longer exists',
        { deviceId: deviceId.toString() }
      );
      return Result.ok(false);
    }

    const decision = this.eligibility.canAlert(deviceResult.value);
    if (!decision.eligible) {
      this.logger.warn(
        'Suppressed a device-down alert for an ineligible device',
        {
          deviceId: deviceId.toString(),
          reason: decision.reason
        }
      );
      return Result.ok(false);
    }

    return Result.ok(true);
  }

  private async resolveIpAddress(
    deviceId: DeviceId
  ): Promise<string | null> {
    try {
      const result =
        await this.pollingConfigRepository.findByDeviceId(deviceId);
      if (result.isSuccess && result.value?.ipAddress) {
        return result.value.ipAddress.value;
      }
    } catch {
      // fallback
    }
    return null;
  }

  private buildDetail(params: { ipAddress: string | null }): string {
    const ip = params.ipAddress ? ` IP: ${params.ipAddress}.` : '';
    return `Sin conexión.${ip}`;
  }
}
