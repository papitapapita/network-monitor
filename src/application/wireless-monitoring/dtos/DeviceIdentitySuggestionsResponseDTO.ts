export type DeviceIdentitySuggestionField = 'name' | 'macAddress';

export interface DeviceIdentitySuggestionDTO {
  field: DeviceIdentitySuggestionField;
  currentValue: string | null;
  suggestedValue: string;
}

export interface DeviceIdentitySuggestionsResponseDTO {
  deviceId: string;
  polled: boolean;
  collectedAt: string | null;
  suggestions: DeviceIdentitySuggestionDTO[];
}
