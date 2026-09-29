import { Result } from 'domain/shared/core';
import { DeviceFilters } from 'domain/device-inventory/repository';
import { ConnectivityStatus, DeviceListItemDTO } from '../dtos';

export type DeviceListCriteria = Omit<DeviceFilters, 'sortBy'> & {
  // Matches monitored devices only. UNKNOWN includes a monitored device that
  // has not been polled yet and so has no recorded state, and one behind an
  // agent that is not reporting (MON-006), whatever its stored state.
  connectivity?: ConnectivityStatus;
  sortBy?: DeviceFilters['sortBy'] | 'downSince';
};

/**
 * Read side of the device listing. Connectivity belongs to device-monitoring,
 * so filtering, sorting and reporting it cannot go through IDeviceRepository
 * without pulling that context into inventory — this port joins the two for
 * display only and returns DTOs, never a Device aggregate.
 */
export interface IDeviceListQuery {
  list(
    criteria: DeviceListCriteria
  ): Promise<Result<DeviceListItemDTO[]>>;
  count(criteria: DeviceListCriteria): Promise<Result<number>>;
}
