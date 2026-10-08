export type DeviceIdentitySuggestionField =
  | 'name'
  | 'macAddress'
  | 'parentApDeviceId';

export interface DeviceIdentitySuggestionDTO {
  field: DeviceIdentitySuggestionField;
  currentValue: string | null;
  suggestedValue: string;
  // Display names for values that are ids (parentApDeviceId); null otherwise.
  currentLabel: string | null;
  suggestedLabel: string | null;
}

export interface DeviceIdentitySuggestionsResponseDTO {
  deviceId: string;
  polled: boolean;
  collectedAt: string | null;
  suggestions: DeviceIdentitySuggestionDTO[];
}
