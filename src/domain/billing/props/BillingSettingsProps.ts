import { BillingMode } from '../enums';

export interface BillingSettingsProps {
  automaticBillingEnabled: boolean;
  billingMode: BillingMode;
  issueLeadDays: number;
  graceDays: number;
  // Cut unpaid customers after the grace days (BIL-310); separate from billing.
  automaticCutEnabled: boolean;
  // The ISP's approved WhatsApp template for payment reminders (BIL-322);
  // null sends reminders by email only.
  reminderWhatsAppTemplate: string | null;
}
