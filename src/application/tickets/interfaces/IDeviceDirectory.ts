import { Result } from 'domain/shared/core';
import { TicketDeviceSummaryDTO } from '../dtos';

/**
 * Read-only window onto the device-inventory context — the same anti-corruption
 * move as ICustomerDirectory. Returns a flat summary, never a Device aggregate.
 */
export interface IDeviceDirectory {
  findSummary(
    deviceId: string
  ): Promise<Result<TicketDeviceSummaryDTO | null>>;
  exists(deviceId: string): Promise<Result<boolean>>;
}
