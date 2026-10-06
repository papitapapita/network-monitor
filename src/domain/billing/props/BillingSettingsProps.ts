import { BillingMode } from '../enums';

export interface BillingSettingsProps {
  automaticBillingEnabled: boolean;
  billingMode: BillingMode;
  issueLeadDays: number;
  graceDays: number;
  // Cut unpaid customers after the grace days (BIL-310); separate from billing.
  automaticCutEnabled: boolean;
}
