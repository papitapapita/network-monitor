export interface BulkUpsertDeviceNotificationPoliciesDTO {
  deviceIds: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null;
}
