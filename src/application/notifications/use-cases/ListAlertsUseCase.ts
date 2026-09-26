import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/shared/enums';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import { AlertListResponseDTO, ListAlertsDTO } from '../dtos';
import { AlertListCriteria, IAlertListQuery } from '../interfaces';

export class ListAlertsUseCase extends UseCase<
  ListAlertsDTO,
  AlertListResponseDTO
> {
  private static readonly STATUSES = ['OPEN', 'RESOLVED'] as const;

  constructor(
    private readonly alertListQuery: IAlertListQuery,
    logger: ILogger
  ) {
    super(logger, 'ListAlertsUseCase');
  }

  protected async executeImpl(
    request: ListAlertsDTO
  ): Promise<Result<AlertListResponseDTO>> {
    const limit = request.limit ?? 50;
    const offset = request.offset ?? 0;

    let deviceId: DeviceId | undefined;
    if (request.deviceId) {
      const deviceIdResult = DeviceId.parse(request.deviceId);
      if (deviceIdResult.isFailure) {
        return this.fail(
          `Invalid device ID: ${deviceIdResult.error}`
        );
      }
      deviceId = deviceIdResult.value;
    }

    let status: AlertListCriteria['status'];
    if (request.status !== undefined) {
      status = ListAlertsUseCase.STATUSES.find(
        (value) => value === request.status
      );
      if (status === undefined) {
        return this.fail(
          `Invalid alert status: "${request.status}". Must be one of: ${ListAlertsUseCase.STATUSES.join(', ')}`
        );
      }
    }

    let severity: AlertSeverity | undefined;
    if (request.severity !== undefined) {
      severity = Object.values(AlertSeverity).find(
        (value) => value === request.severity
      );
      if (severity === undefined) {
        return this.fail(
          `Invalid alert severity: "${request.severity}". Must be one of: ${Object.values(AlertSeverity).join(', ')}`
        );
      }
    }

    const filters = { deviceId, status, severity };

    const alertsResult = await this.alertListQuery.list({
      ...filters,
      limit,
      offset
    });
    if (alertsResult.isFailure) {
      return this.fail(
        `Failed to list alerts: ${alertsResult.error}`
      );
    }

    // The total must come from a count over the same filters: the page length
    // made hasMore false on every page, so the listing could never page.
    const countResult = await this.alertListQuery.count(filters);
    if (countResult.isFailure) {
      return this.fail(
        `Failed to count alerts: ${countResult.error}`
      );
    }

    return this.ok(
      AlertMapper.toListDTO(
        alertsResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }
}
