export interface PollWirelessDeviceResponseDTO {
  deviceId: string;
  collectedAt: string;
  metricsCollected: boolean;
  alertsTriggered: number;
  alertsCleared: number;
  collectionMethod: string;
  skipped?: boolean;
}
