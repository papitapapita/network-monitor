import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { INotificationService } from '../interfaces';
import { TelegramFormatting } from '../shared';
import { AlertMapper } from '../mappers';
import {
  AlertResponseDTO,
  SendDeviceRecoveryAlertDTO
} from '../dtos';

export class SendDeviceRecoveryAlertUseCase extends UseCase<
  SendDeviceRecoveryAlertDTO,
  AlertResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly deviceRepository: IDeviceRepository,
    private readonly pollingConfigRepository: IPollingConfigurationRepository,
    private readonly notificationService: INotificationService,
    logger: ILogger
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
      await this.alertRepository.findOpenByDeviceId(deviceId);
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

    const deviceName = await this.resolveDeviceName(deviceId);
    const ipAddress = await this.resolveIpAddress(deviceId);

    const message = {
      title: '🟢 Dispositivo de vuelta en línea',
      body: this.formatRecoveryMessage({
        deviceName,
        ipAddress,
        latencyMs: request.latencyMs,
        occurredAt: request.occurredAt,
        durationSecs: openAlert.durationSecs,
        alertId: openAlert.id.toString()
      }),
      metadata: {
        deviceId: deviceId.toString(),
        deviceName,
        ipAddress,
        severity: openAlert.severity,
        alertId: openAlert.id.toString(),
        timestamp: request.occurredAt.toISOString(),
        latencyMs: request.latencyMs,
        durationSecs: openAlert.durationSecs
      }
    };

    const sendResult = await this.notificationService.send(message);
    if (sendResult.isFailure) {
      this.logger.error(
        'Failed to send Telegram notification for device recovery',
        undefined,
        { deviceId: deviceId.toString(), error: sendResult.error }
      );
    } else {
      openAlert.markRecoveryNotified();
    }

    const saveResult = await this.alertRepository.save(openAlert);
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

  private formatRecoveryMessage(params: {
    deviceName: string;
    ipAddress: string | null;
    latencyMs: number | null;
    occurredAt: Date;
    durationSecs: number | null;
    alertId: string;
  }): string {
    const e = (text: string) => TelegramFormatting.escapeMd(text);
    const ip = params.ipAddress ? e(params.ipAddress) : 'N/A';
    const ts = e(
      TelegramFormatting.formatLocalTime(params.occurredAt)
    );
    const latency =
      params.latencyMs !== null ? `${params.latencyMs}ms` : 'N/A';
    const duration = this.formatDuration(params.durationSecs);

    return [
      '🟢 *DISPOSITIVO DE VUELTA EN LÍNEA*',
      '',
      `📛 *Dispositivo:* ${e(params.deviceName)}`,
      `🌐 *Dirección IP:* ${ip}`,
      `✅ *Severidad:* CRÍTICA`,
      `⚡ *Latencia:* ${e(latency)}`,
      `⏱️ *Tiempo fuera de línea:* ${e(duration)}`,
      `🕐 *Recuperado a las:* ${ts}`,
      '',
      `🆔 Alerta: \`${e(params.alertId)}\``
    ].join('\n');
  }

  private formatDuration(secs: number | null): string {
    if (secs === null) return 'unknown';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }
}
