// What the hardware itself reports against the inventory record (WLS-152,
// DEV-215): a radio's AirOS or a MikroTik's RouterOS.
export type DeviceIdentitySuggestionField =
  | 'name'
  | 'macAddress'
  | 'serialNumber'
  | 'upstreamDeviceId'
  | 'deviceModel';

// UPDATE: edit the inventory record. REPLACE: the box is a new unit, so
// register it through the replace flow (DEV-078). SWAP: the box is another
// inventory unit that traded places with this one (swap-hardware, `swapWith`).
// Ordered by recommendation, first is best.
export type DeviceIdentitySuggestionAction =
  | 'UPDATE'
  | 'REPLACE'
  | 'SWAP';

export interface SwapCandidateDTO {
  deviceId: string;
  name: string;
}

export interface DeviceIdentitySuggestionDTO {
  field: DeviceIdentitySuggestionField;
  currentValue: string | null;
  // Null only for deviceModel when the reported model is not in the catalog.
  suggestedValue: string | null;
  // Display names for values that are ids (upstreamDeviceId, deviceModel);
  // null otherwise.
  currentLabel: string | null;
  suggestedLabel: string | null;
  actions: DeviceIdentitySuggestionAction[];
  swapWith: SwapCandidateDTO | null;
}
