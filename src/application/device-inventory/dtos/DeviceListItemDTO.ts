import { DeviceConnectivityDTO } from './DeviceConnectivityDTO';
import { DeviceResponseDTO } from './DeviceResponseDTO';

export interface DeviceListItemDTO extends DeviceResponseDTO {
  // Null when monitoring is off: whatever state was last recorded is stale.
  connectivity: DeviceConnectivityDTO | null;
}
