import { ValueObject, Result } from 'domain/shared/core';
import { BillingMode } from '../enums';
import { BillingSettingsProps } from '../props';

export const MIN_ISSUE_LEAD_DAYS = 1;
export const MAX_ISSUE_LEAD_DAYS = 14;
export const MAX_GRACE_DAYS = 14;
// Meta's rule for template names.
const WHATSAPP_TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;

// The install's billing cycle settings (BIL-280), edited by the ISP's
// administrator and replaced as a whole.
export class BillingSettings extends ValueObject<BillingSettingsProps> {
  get automaticBillingEnabled(): boolean {
    return this._props.automaticBillingEnabled;
  }

  get billingMode(): BillingMode {
    return this._props.billingMode;
  }

  get issueLeadDays(): number {
    return this._props.issueLeadDays;
  }

  get graceDays(): number {
    return this._props.graceDays;
  }

  get automaticCutEnabled(): boolean {
    return this._props.automaticCutEnabled;
  }

  get reminderWhatsAppTemplate(): string | null {
    return this._props.reminderWhatsAppTemplate;
  }

  get billWhatsAppTemplate(): string | null {
    return this._props.billWhatsAppTemplate;
  }

  private constructor(props: BillingSettingsProps) {
    super(props);
  }

  public static create(
    props: BillingSettingsProps
  ): Result<BillingSettings> {
    const error = BillingSettings.validate(props);
    if (error) return Result.fail<BillingSettings>(error);
    return Result.ok(
      new BillingSettings({
        ...props,
        reminderWhatsAppTemplate:
          props.reminderWhatsAppTemplate?.trim() || null,
        billWhatsAppTemplate:
          props.billWhatsAppTemplate?.trim() || null
      })
    );
  }

  // What applies until the administrator saves the settings (BIL-281). Off,
  // so an install that bills by hand is not changed by the upgrade.
  public static defaults(): BillingSettings {
    return new BillingSettings({
      automaticBillingEnabled: false,
      billingMode: BillingMode.ADVANCE,
      issueLeadDays: 5,
      graceDays: 3,
      automaticCutEnabled: false,
      reminderWhatsAppTemplate: null,
      billWhatsAppTemplate: null
    });
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    props: BillingSettingsProps
  ): BillingSettings {
    return new BillingSettings(props);
  }

  private static validate(
    props: BillingSettingsProps
  ): string | null {
    if (typeof props.automaticBillingEnabled !== 'boolean') {
      return 'automaticBillingEnabled must be true or false';
    }
    if (!Object.values(BillingMode).includes(props.billingMode)) {
      return `billingMode must be one of ${Object.values(BillingMode).join(', ')}`;
    }
    if (
      !Number.isInteger(props.issueLeadDays) ||
      props.issueLeadDays < MIN_ISSUE_LEAD_DAYS ||
      props.issueLeadDays > MAX_ISSUE_LEAD_DAYS
    ) {
      return `issueLeadDays must be a whole number from ${MIN_ISSUE_LEAD_DAYS} to ${MAX_ISSUE_LEAD_DAYS}`;
    }
    if (
      !Number.isInteger(props.graceDays) ||
      props.graceDays < 0 ||
      props.graceDays > MAX_GRACE_DAYS
    ) {
      return `graceDays must be a whole number from 0 to ${MAX_GRACE_DAYS}`;
    }
    if (typeof props.automaticCutEnabled !== 'boolean') {
      return 'automaticCutEnabled must be true or false';
    }
    for (const field of [
      'reminderWhatsAppTemplate',
      'billWhatsAppTemplate'
    ] as const) {
      if (!BillingSettings.isTemplateName(props[field])) {
        return `${field} must be a WhatsApp template name: lowercase letters, digits and underscores, up to 512`;
      }
    }
    return null;
  }

  // Blank counts as no template.
  private static isTemplateName(template: unknown): boolean {
    if (template === null) return true;
    if (typeof template !== 'string') return false;
    return (
      template.trim() === '' ||
      WHATSAPP_TEMPLATE_NAME.test(template.trim())
    );
  }
}
