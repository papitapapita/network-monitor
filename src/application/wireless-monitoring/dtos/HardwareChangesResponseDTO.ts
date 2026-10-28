import { DeviceIdentitySuggestionDTO } from './DeviceIdentitySuggestionsResponseDTO';

export interface HardwareChangeDTO {
  deviceId: string;
  name: string;
  collectedAt: string;
  // Only macAddress and deviceModel suggestions.
  suggestions: DeviceIdentitySuggestionDTO[];
}

export interface HardwareChangesResponseDTO {
  devices: HardwareChangeDTO[];
}
