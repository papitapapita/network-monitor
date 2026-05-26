import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { AlertSeverity } from 'domain/notifications/enums';
import { IAlertRepository } from 'domain/notifications/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { INotificationService } from '../interfaces';
import { AlertMapper } from '../mappers';
import { AlertResponseDTO, SendDeviceDownAlertDTO } from '../dtos';

export class SendDeviceDownAlertUseCase extends UseCase<
  SendDeviceDownAlertDTO,
  AlertResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly deviceRepository: IDeviceRepository,
    private readonly pollingConfigRepository: IPollingConfigurationRepository,
    private readonly notificationService: INotificationService,
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
      await this.alertRepository.findOpenByDeviceId(deviceId);
    if (existingResult.isFailure) {
      return this.fail(
        `Failed to check existing alerts: ${existingResult.error}`
      );
    }
    if (existingResult.value !== null) {
      return this.ok(AlertMapper.toDTO(existingResult.value));
    }

    const alertResult = Alert.open(deviceId, AlertSeverity.CRITICAL);
    if (alertResult.isFailure) {
      return this.fail(
        `Failed to create alert: ${alertResult.error}`
      );
    }
    const alert = alertResult.value;

    const deviceName = await this.resolveDeviceName(deviceId);
    const ipAddress = await this.resolveIpAddress(deviceId);

    const message = {
      title: '🔴 Dispositivo fuera de línea',
      body: this.formatDownMessage({
        deviceName,
        ipAddress,
        consecutiveFailures: request.consecutiveFailures,
        occurredAt: request.occurredAt,
        alertId: alert.id.toString()
      }),
      metadata: {
        deviceId: deviceId.toString(),
        deviceName,
        ipAddress,
        severity: AlertSeverity.CRITICAL,
        alertId: alert.id.toString(),
        timestamp: request.occurredAt.toISOString(),
        consecutiveFailures: request.consecutiveFailures
      }
    };

    const sendResult = await this.notificationService.send(message);
    if (sendResult.isFailure) {
      this.logger.error(
        'Failed to send Telegram notification for device down',
        undefined,
        { deviceId: deviceId.toString(), error: sendResult.error }
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
    return 'Unknown Device';
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

  private formatDownMessage(params: {
    deviceName: string;
    ipAddress: string | null;
    consecutiveFailures: number;
    occurredAt: Date;
    alertId: string;
  }): string {
    const e = (text: string) => this.escapeMd(text);
    const ip = params.ipAddress ? e(params.ipAddress) : 'N/A';
    const ts = e(this.formatLocalTime(params.occurredAt));

    return [
      '🔴 *DISPOSITIVO FUERA DE LÍNEA*',
      '',
      `📛 *Dispositivo:* ${e(params.deviceName)}`,
      `🌐 *Dirección IP:* ${ip}`,
      `⚠️ *Severidad:* CRÍTICA`,
      `❌ *Fallos Consecutivos:* ${params.consecutiveFailures}`,
      `🕐 *Sin conexión desde:* ${ts}`,
      '',
      `🆔 Alerta: \`${e(params.alertId)}\``
    ].join('\n');
  }

  private formatLocalTime(date: Date): string {
    return date.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  private escapeMd(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
  }
}
