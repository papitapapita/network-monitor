export interface IssuerSettingsDTO {
  name: string;
  documentLabel: string;
  document: string;
  address: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  accentColorHex: string;
}

export interface WhatsAppSettingsDTO {
  phoneNumberId: string;
  templateName: string;
  templateLanguage: string;
  apiVersion: string;
}

export interface EnforcementRouterSettingsDTO {
  deviceId: string;
  apiPort: number;
}

export interface VendorSettingsDTO {
  vendorTelegramChatId: string | null;
  subscriptionPaidUntil: string | null; // YYYY-MM-DD, last day paid; null = not enforced
  subscriptionGraceDays: number;
  subscriptionReadOnlyDays: number;
  pingResultRetentionDays: number;
  alertRetentionDays: number;
  wirelessSnapshotRetentionDays: number;
  wirelessAlertRecordRetentionDays: number;
  issuer: IssuerSettingsDTO | null;
  whatsApp: WhatsAppSettingsDTO | null;
  enforcementRouter: EnforcementRouterSettingsDTO | null;
}
