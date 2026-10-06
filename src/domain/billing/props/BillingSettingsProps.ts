import { BillingMode } from '../enums';

export interface BillingSettingsProps {
  automaticBillingEnabled: boolean;
  billingMode: BillingMode;
  issueLeadDays: number;
  graceDays: number;
}
