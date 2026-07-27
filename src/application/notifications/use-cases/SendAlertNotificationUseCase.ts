import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/notifications/enums';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { INotificationService } from '../interfaces';
import { TelegramFormatting } from '../shared';
import { SendAlertNotificationDTO } from '../dtos';

export class SendAlertNotificationUseCase extends UseCase<
  SendAlertNotificationDTO,
  void
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly notificationService: INotificationService,
    logger: ILogger
  ) {
    super(logger, 'SendAlertNotificationUseCase');
  }

  protected async beforeExecute(
    request: SendAlertNotificationDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    if (!request.detail?.trim()) {
      return Result.fail('detail is required');
    }
    return null;
  }

  protected async executeImpl(
    request: SendAlertNotificationDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deviceName = await this.resolveDeviceName(
      deviceIdResult.value
    );

    const sendResult = await this.notificationService.send({
      title: this.buildTitle(request),
      body: this.formatBody(request, deviceName),
      metadata: {
        deviceId: request.deviceId,
        deviceName,
        ipAddress: null,
        severity: request.severity,
        timestamp: request.occurredAt.toISOString()
      }
    });

    if (sendResult.isFailure) {
      return this.fail(
        `Failed to send alert notification: ${sendResult.error}`
      );
    }

    return this.ok(undefined);
  }

  private buildTitle(request: SendAlertNotificationDTO): string {
    if (request.resolved) return '✅ Alerta resuelta';
    return request.severity === AlertSeverity.CRITICAL
      ? '🔴 Alerta crítica'
      : '🟡 Advertencia';
  }

  private formatBody(
    request: SendAlertNotificationDTO,
    deviceName: string
  ): string {
    const e = (text: string) => TelegramFormatting.escapeMd(text);
    const ts = e(
      TelegramFormatting.formatLocalTime(request.occurredAt)
    );

    const header = request.resolved
      ? '✅ *ALERTA RESUELTA*'
      : request.severity === AlertSeverity.CRITICAL
        ? '🔴 *ALERTA CRÍTICA*'
        : '🟡 *ADVERTENCIA*';

    const severityLabel =
      request.severity === AlertSeverity.CRITICAL
        ? 'CRÍTICA'
        : 'ADVERTENCIA';

    return [
      header,
      '',
      `📛 *Dispositivo:* ${e(deviceName)}`,
      `📡 *Origen:* ${e(request.source)}`,
      `📊 *Métrica:* ${e(request.subject)}`,
      `⚠️ *Severidad:* ${e(severityLabel)}`,
      '',
      e(request.detail),
      '',
      `🕐 ${ts}`
    ].join('\n');
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
}
