import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/shared/enums';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { INotificationService } from '../interfaces';
import { TelegramFormatting } from '../shared';
import { SendAlertNotificationDTO } from '../dtos';

interface DeviceLabel {
  name: string;
  ipAddress: string | null;
}

export class SendAlertNotificationUseCase extends UseCase<
  SendAlertNotificationDTO,
  void
> {
  // appPublicUrl is the dashboard's origin as the operator's phone reaches
  // it; null leaves the "open in the app" link out.
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly notificationService: INotificationService,
    logger: ILogger,
    private readonly appPublicUrl: string | null = null
  ) {
    super(logger, 'SendAlertNotificationUseCase');
  }

  protected async beforeExecute(
    request: SendAlertNotificationDTO
  ): Promise<Result<void> | null> {
    if (request.deviceId !== null && !request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    if (!request.summary?.trim()) {
      return Result.fail('summary is required');
    }
    return null;
  }

  protected async executeImpl(
    request: SendAlertNotificationDTO
  ): Promise<Result<void>> {
    let device: DeviceLabel | null = null;
    if (request.deviceId !== null) {
      const deviceIdResult = DeviceId.parse(request.deviceId);
      if (deviceIdResult.isFailure) {
        return this.fail(
          `Invalid device ID: ${deviceIdResult.error}`
        );
      }
      device = await this.resolveDevice(deviceIdResult.value);
    }

    const sendResult = await this.notificationService.send({
      title: `${this.icon(request)} ${request.summary}`,
      body: this.formatBody(request, device),
      metadata: {
        deviceId: request.deviceId,
        deviceName: device?.name ?? null,
        ipAddress: device?.ipAddress ?? null,
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

  private icon(request: SendAlertNotificationDTO): string {
    if (request.resolved) return '✅';
    return request.severity === AlertSeverity.CRITICAL ? '🔴' : '🟡';
  }

  private formatBody(
    request: SendAlertNotificationDTO,
    device: DeviceLabel | null
  ): string {
    const e = (text: string) => TelegramFormatting.escapeMd(text);
    const ts = TelegramFormatting.formatLocalTime(request.occurredAt);
    const detail = request.detail?.trim();

    return [
      `${this.icon(request)} *${e(request.summary)}*`,
      ...(detail ? [e(detail)] : []),
      '',
      ...(device !== null
        ? this.deviceLines(request.deviceId as string, device)
        : []),
      `🕐 ${e(`${ts} · ${request.source}`)}`
    ].join('\n');
  }

  private deviceLines(
    deviceId: string,
    device: DeviceLabel
  ): string[] {
    const e = (text: string) => TelegramFormatting.escapeMd(text);
    const lines = [`📛 ${e(device.name)}`];
    if (device.ipAddress !== null) {
      lines.push(
        `🌐 ${TelegramFormatting.link(device.ipAddress, `http://${device.ipAddress}`)}`
      );
    }
    if (this.appPublicUrl !== null) {
      lines.push(
        `📱 ${TelegramFormatting.link('Ver en la app', `${this.appPublicUrl}/devices/${deviceId}`)}`
      );
    }
    return lines;
  }

  private async resolveDevice(
    deviceId: DeviceId
  ): Promise<DeviceLabel> {
    try {
      const result = await this.deviceRepository.findById(deviceId);
      if (result.isSuccess && result.value) {
        return {
          name: result.value.name.value,
          ipAddress: result.value.ipAddress?.value ?? null
        };
      }
    } catch {
      // fallback
    }
    return { name: 'Unknown Device', ipAddress: null };
  }
}
