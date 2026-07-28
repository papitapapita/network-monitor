import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { AlertSeverity } from 'domain/shared/enums';
import { IAlertRepository } from 'domain/notifications/repository';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger, IAlertPublisher } from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import { AlertResponseDTO, SendDeviceDownAlertDTO } from '../dtos';

const SOURCE = 'Disponibilidad';
const SUBJECT = 'Dispositivo fuera de línea';
const ALERT_TYPE = 'device_unreachable';

export class SendDeviceDownAlertUseCase extends UseCase<
  SendDeviceDownAlertDTO,
  AlertResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly pollingConfigRepository: IPollingConfigurationRepository,
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
        `Failed to check existing alerts: ${existingResult.error}`
      );
    }
    if (existingResult.value !== null) {
      return this.ok(AlertMapper.toDTO(existingResult.value));
    }

    const ipAddress = await this.resolveIpAddress(deviceId);
    const detail = this.buildDetail({
      ipAddress,
      consecutiveFailures: request.consecutiveFailures
    });

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

  private buildDetail(params: {
    ipAddress: string | null;
    consecutiveFailures: number;
  }): string {
    const ip = params.ipAddress ? ` IP: ${params.ipAddress}.` : '';
    return `Sin conexión tras ${params.consecutiveFailures} intento(s) fallido(s).${ip}`;
  }
}
