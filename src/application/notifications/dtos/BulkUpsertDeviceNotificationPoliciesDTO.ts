export interface BulkUpsertDeviceNotificationPoliciesDTO {
  deviceIds: string[];
  quietHoursMode?: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null;
}
