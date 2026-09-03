export interface DeviceNotificationPolicyResponseDTO {
  deviceId: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null;
  // null when no policy has ever been saved for this device — it is running
  // on system defaults, not a row that was reset.
  updatedAt: string | null;
}
