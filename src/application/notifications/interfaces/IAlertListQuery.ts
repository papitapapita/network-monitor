import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/shared/enums';
import { AlertListItemDTO } from '../dtos';

export type AlertListRow = Omit<AlertListItemDTO, 'ticketSuggested'>;

export interface AlertListCriteria {
  deviceId?: DeviceId;
  status?: 'OPEN' | 'RESOLVED';
  severity?: AlertSeverity;
  limit: number;
  offset: number;
}

/**
 * Read side of the alert listing. The device name belongs to device-inventory
 * and the live ticket to tickets, so both are joined here for display rather
 * than copied onto the Alert aggregate, where they would go stale.
 */
export interface IAlertListQuery {
  list(criteria: AlertListCriteria): Promise<Result<AlertListRow[]>>;
  count(
    criteria: Omit<AlertListCriteria, 'limit' | 'offset'>
  ): Promise<Result<number>>;
}
