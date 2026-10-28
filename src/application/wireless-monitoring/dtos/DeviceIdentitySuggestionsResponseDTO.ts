import type { DeviceIdentitySuggestionDTO } from 'application/device-inventory/dtos/HardwareSuggestionDTO';

export interface DeviceIdentitySuggestionsResponseDTO {
  deviceId: string;
  polled: boolean;
  collectedAt: string | null;
  suggestions: DeviceIdentitySuggestionDTO[];
}
