import { BillingSettings } from 'domain/billing/value-objects';
import { BillingSettingsDTO } from '../dtos';

export class BillingSettingsMapper {
  static toDTO(settings: BillingSettings): BillingSettingsDTO {
    return {
      automaticBillingEnabled: settings.automaticBillingEnabled,
      billingMode: settings.billingMode,
      issueLeadDays: settings.issueLeadDays,
      graceDays: settings.graceDays,
      automaticCutEnabled: settings.automaticCutEnabled,
      reminderWhatsAppTemplate: settings.reminderWhatsAppTemplate,
      billWhatsAppTemplate: settings.billWhatsAppTemplate
    };
  }
}
