export interface SendDeviceRecoveryAlertDTO {
  deviceId: string;
  latencyMs: number | null;
  occurredAt: Date;
}
