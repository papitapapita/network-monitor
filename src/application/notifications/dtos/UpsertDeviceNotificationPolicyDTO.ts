export interface UpsertDeviceNotificationPolicyDTO {
  deviceId: string;
  // both null or both a HH:mm string — never one without the other
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null;
}
