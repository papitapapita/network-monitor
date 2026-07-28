import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger, IAlertPublisher } from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import {
  AlertResponseDTO,
  SendDeviceRecoveryAlertDTO
} from '../dtos';

const SOURCE = 'Disponibilidad';
const SUBJECT = 'Dispositivo recuperado';
const ALERT_TYPE = 'device_unreachable';

export class SendDeviceRecoveryAlertUseCase extends UseCase<
  SendDeviceRecoveryAlertDTO,
  AlertResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly pollingConfigRepository: IPollingConfigurationRepository,
    private readonly alertPublisher: IAlertPublisher,
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

    const ipAddress = await this.resolveIpAddress(deviceId);

    const publishResult = await this.alertPublisher.publish({
      deviceId: deviceId.toString(),
      severity: openAlert.severity,
      source: SOURCE,
      subject: SUBJECT,
      detail: this.buildDetail({
        ipAddress,
        latencyMs: request.latencyMs,
        durationSecs: openAlert.durationSecs
      }),
      occurredAt: request.occurredAt,
      resolved: true
    });

    if (publishResult.isFailure) {
      this.logger.error(
        'Failed to publish device-recovery alert notification',
        undefined,
        { deviceId: deviceId.toString(), error: publishResult.error }
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
    latencyMs: number | null;
    durationSecs: number | null;
  }): string {
    const ip = params.ipAddress ? ` IP: ${params.ipAddress}.` : '';
    const latency =
      params.latencyMs !== null ? `${params.latencyMs}ms` : 'N/A';
    const duration = this.formatDuration(params.durationSecs);
    return [
      `Conexión restablecida.${ip}`,
      `Latencia: ${latency}. Tiempo fuera de línea: ${duration}.`
    ].join('\n');
  }

  private formatDuration(secs: number | null): string {
    if (secs === null) return 'desconocido';
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
