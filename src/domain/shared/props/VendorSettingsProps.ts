// Printed on every cuenta de cobro: the install bills as its own company.
export interface IssuerSettingsProps {
  name: string;
  documentLabel: string; // 'NIT', 'CC'…
  document: string;
  address: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  accentColorHex: string; // '#1F4E79'
}

// The non-secret half of the WhatsApp Cloud API setup; the access token stays
// in env.
export interface WhatsAppSettingsProps {
  phoneNumberId: string;
  templateName: string;
  templateLanguage: string;
  apiVersion: string;
}

// The MikroTik that applies suspensions; its address and login come from the
// device's own record and credentials.
export interface EnforcementRouterSettingsProps {
  deviceId: string;
  apiPort: number;
}

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
  // null in each: not configured, so that feature does not run.
  issuer: IssuerSettingsProps | null;
  whatsApp: WhatsAppSettingsProps | null;
  enforcementRouter: EnforcementRouterSettingsProps | null;
}
