export interface VendorSettingsDTO {
  vendorTelegramChatId: string | null;
  subscriptionPaidUntil: string | null; // YYYY-MM-DD, last day paid; null = not enforced
  subscriptionGraceDays: number;
  subscriptionReadOnlyDays: number;
  pingResultRetentionDays: number;
  alertRetentionDays: number;
  wirelessSnapshotRetentionDays: number;
  wirelessAlertRecordRetentionDays: number;
}
