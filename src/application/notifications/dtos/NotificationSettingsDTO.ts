export interface NotificationSettingsDTO {
  telegramChatId: string | null;
  downAlertDelayMinutes: number;
  wirelessAlertsEnabled: boolean;
}

export interface SendTestNotificationDTO {
  // Unsaved value from the form; the saved chat when omitted.
  telegramChatId?: string;
}

export interface SendTestNotificationResponseDTO {
  telegramChatId: string;
}
