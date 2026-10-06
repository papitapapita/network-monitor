import { BillingMode } from 'domain/billing/enums';

export interface BillingSettingsDTO {
  automaticBillingEnabled: boolean;
  billingMode: BillingMode;
  issueLeadDays: number;
  graceDays: number;
}
