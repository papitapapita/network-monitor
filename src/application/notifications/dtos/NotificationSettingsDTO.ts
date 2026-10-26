export interface NotificationSettingsDTO {
  telegramChatId: string | null;
  downAlertDelayMinutes: number;
  wirelessAlertsEnabled: boolean;
  alertTicketMode: string;
  // Install-wide quiet hours, HH:mm; both null when there are none.
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

// alertTicketMode and the quiet hours are optional so a dashboard that
// predates them can still save the other settings; omitted, the saved values
// are kept.
export interface UpdateNotificationSettingsDTO
  extends Omit<
    NotificationSettingsDTO,
    'alertTicketMode' | 'quietHoursStart' | 'quietHoursEnd'
  > {
  alertTicketMode?: string;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export interface SendTestNotificationDTO {
  // Unsaved value from the form; the saved chat when omitted.
  telegramChatId?: string;
}

export interface SendTestNotificationResponseDTO {
  telegramChatId: string;
}
