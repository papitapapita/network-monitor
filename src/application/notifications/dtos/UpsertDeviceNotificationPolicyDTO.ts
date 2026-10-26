export interface UpsertDeviceNotificationPolicyDTO {
  deviceId: string;
  // INHERIT, CUSTOM or ALWAYS_NOTIFY. Omitted: CUSTOM when a window is sent,
  // INHERIT when it is not, which is what a dashboard that predates the mode
  // means by each.
  quietHoursMode?: string;
  // both null or both a HH:mm string — never one without the other; set
  // exactly when the mode is CUSTOM
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null;
}
