import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { AlertMapper } from '../mappers/AlertMapper';
import { AlertListResponseDTO, ListAlertsDTO } from '../dtos';

export class ListAlertsUseCase extends UseCase<
  ListAlertsDTO,
  AlertListResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'ListAlertsUseCase');
  }

  protected async executeImpl(
    request: ListAlertsDTO
  ): Promise<Result<AlertListResponseDTO>> {
    const limit = request.limit ?? 50;
    const offset = request.offset ?? 0;

    if (request.deviceId) {
      const deviceIdResult = DeviceId.parse(request.deviceId);
      if (deviceIdResult.isFailure) {
        return this.fail(
          `Invalid device ID: ${deviceIdResult.error}`
        );
      }

      const alertsResult =
        await this.alertRepository.findAllByDeviceId(
          deviceIdResult.value,
          limit,
          offset
        );
      if (alertsResult.isFailure) {
        return this.fail(
          `Failed to list alerts: ${alertsResult.error}`
        );
      }

      const alerts = alertsResult.value;
      return this.ok(
        AlertMapper.toListDTO(alerts, alerts.length, limit, offset)
      );
    }

    const alertsResult = await this.alertRepository.findAll(
      limit,
      offset
    );
    if (alertsResult.isFailure) {
      return this.fail(
        `Failed to list alerts: ${alertsResult.error}`
      );
    }

    const alerts = alertsResult.value;
    return this.ok(
      AlertMapper.toListDTO(alerts, alerts.length, limit, offset)
    );
  }
}
