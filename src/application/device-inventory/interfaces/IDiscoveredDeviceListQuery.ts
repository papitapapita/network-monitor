import { Result } from 'domain/shared/core';
import { DiscoveredDeviceDTO } from '../dtos';

// DEV-203: leaves out a suggestion whose MAC or IP a live device now owns,
// so creating the device clears it without waiting for the next sighting.
export interface IDiscoveredDeviceListQuery {
  list(ignored: boolean): Promise<Result<DiscoveredDeviceDTO[]>>;
}
