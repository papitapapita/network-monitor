export interface VendorSettingsProps {
  // null: agent-health alerts reach only the install's own chat.
  vendorTelegramChatId: string | null;
  // Last day paid for, YYYY-MM-DD in Colombian time; null: not enforced.
  subscriptionPaidUntil: string | null;
  subscriptionGraceDays: number;
  subscriptionReadOnlyDays: number;
  pingResultRetentionDays: number;
  alertRetentionDays: number;
  wirelessSnapshotRetentionDays: number;
  wirelessAlertRecordRetentionDays: number;
}
