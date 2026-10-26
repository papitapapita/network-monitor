import { QuietHours } from '../value-objects';

// SUGGEST: an alert only offers a ticket, a person decides. AUTOMATIC: every
// new alert opens one on its own (NOT-205).
export type AlertTicketMode = 'SUGGEST' | 'AUTOMATIC';

export interface NotificationSettingsProps {
  // null: no Telegram chat configured — alerts are recorded, not sent.
  telegramChatId: string | null;
  downAlertDelayMinutes: number;
  wirelessAlertsEnabled: boolean;
  alertTicketMode: AlertTicketMode;
  // null: no install-wide quiet hours — only devices with their own window
  // are ever silenced (NOT-207).
  quietHours: QuietHours | null;
}
