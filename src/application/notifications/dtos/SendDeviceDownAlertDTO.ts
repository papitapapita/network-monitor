export interface SendDeviceDownAlertDTO {
  deviceId: string;
  consecutiveFailures: number;
  occurredAt: Date;
}
