import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/shared/enums';
import { AlertListItemDTO } from '../dtos';

export interface AlertListCriteria {
  deviceId?: DeviceId;
  status?: 'OPEN' | 'RESOLVED';
  severity?: AlertSeverity;
  limit: number;
  offset: number;
}

/**
 * Read side of the alert listing. The device name belongs to device-inventory,
 * so it is joined here for display rather than copied onto the Alert
 * aggregate, where it would go stale on every rename.
 */
export interface IAlertListQuery {
  list(
    criteria: AlertListCriteria
  ): Promise<Result<AlertListItemDTO[]>>;
  count(
    criteria: Omit<AlertListCriteria, 'limit' | 'offset'>
  ): Promise<Result<number>>;
}
