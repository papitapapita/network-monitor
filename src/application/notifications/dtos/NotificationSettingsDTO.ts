export interface NotificationSettingsDTO {
  telegramChatId: string | null;
  downAlertDelayMinutes: number;
  wirelessAlertsEnabled: boolean;
  alertTicketMode: string;
}

// alertTicketMode is optional so a dashboard that predates it can still save
// the other settings; omitted, the saved mode is kept.
export interface UpdateNotificationSettingsDTO
  extends Omit<NotificationSettingsDTO, 'alertTicketMode'> {
  alertTicketMode?: string;
}

export interface SendTestNotificationDTO {
  // Unsaved value from the form; the saved chat when omitted.
  telegramChatId?: string;
}

export interface SendTestNotificationResponseDTO {
  telegramChatId: string;
}
