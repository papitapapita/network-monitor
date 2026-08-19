export interface BulkClearWirelessAlertsRequestDTO {
  deviceId: string;
  // omitted — clears every currently active alert for the device
  ids?: string[];
}
