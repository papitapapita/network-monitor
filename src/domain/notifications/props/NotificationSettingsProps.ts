export interface NotificationSettingsProps {
  // null: no Telegram chat configured — alerts are recorded, not sent.
  telegramChatId: string | null;
  downAlertDelayMinutes: number;
  wirelessAlertsEnabled: boolean;
}
