import { Result } from '../core/Result';
import { ValueObject } from '../core/ValueObject';
import {
  EnforcementRouterSettingsProps,
  IssuerSettingsProps,
  VendorSettingsProps,
  WhatsAppSettingsProps
} from '../props/VendorSettingsProps';
import { DeviceId } from '../ids/DeviceId';
import { SubscriptionTerms } from './SubscriptionTerms';
import { isTelegramChatId } from './TelegramChatId';

export const MAX_RETENTION_DAYS = 3650;
const MAX_TEXT = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const WHATSAPP = {
  phoneNumberId: /^\d{1,30}$/,
  templateName: /^[a-z0-9_]{1,512}$/,
  templateLanguage: /^[a-z]{2,3}(_[A-Z]{2})?$/,
  apiVersion: /^v\d+\.\d+$/
};
const DAY_MS = 24 * 60 * 60 * 1000;
// Customers are Colombian ISPs; Colombia is UTC-5 with no daylight saving.
const INSTALL_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;

const RETENTION_FIELDS = [
  'pingResultRetentionDays',
  'alertRetentionDays',
  'wirelessSnapshotRetentionDays',
  'wirelessAlertRecordRetentionDays'
] as const;

// What the vendor runs the install with (INS-028): its own alert chat, the
// customer's subscription terms and how long data is kept. Only the vendor
// edits it, and it is replaced as a whole.
export class VendorSettings extends ValueObject<VendorSettingsProps> {
  get vendorTelegramChatId(): string | null {
    return this._props.vendorTelegramChatId;
  }

  get subscriptionPaidUntil(): string | null {
    return this._props.subscriptionPaidUntil;
  }

  get subscriptionGraceDays(): number {
    return this._props.subscriptionGraceDays;
  }

  get subscriptionReadOnlyDays(): number {
    return this._props.subscriptionReadOnlyDays;
  }

  get pingResultRetentionDays(): number {
    return this._props.pingResultRetentionDays;
  }

  get alertRetentionDays(): number {
    return this._props.alertRetentionDays;
  }

  get wirelessSnapshotRetentionDays(): number {
    return this._props.wirelessSnapshotRetentionDays;
  }

  get wirelessAlertRecordRetentionDays(): number {
    return this._props.wirelessAlertRecordRetentionDays;
  }

  get issuer(): IssuerSettingsProps | null {
    return this._props.issuer;
  }

  get whatsApp(): WhatsAppSettingsProps | null {
    return this._props.whatsApp;
  }

  get enforcementRouter(): EnforcementRouterSettingsProps | null {
    return this._props.enforcementRouter;
  }

  private constructor(props: VendorSettingsProps) {
    super(props);
  }

  public static create(
    props: VendorSettingsProps
  ): Result<VendorSettings> {
    const normalized: VendorSettingsProps = {
      ...props,
      vendorTelegramChatId:
        props.vendorTelegramChatId?.trim() || null,
      subscriptionPaidUntil:
        props.subscriptionPaidUntil?.trim() || null,
      issuer: VendorSettings.trimAll(props.issuer),
      whatsApp: VendorSettings.trimAll(props.whatsApp),
      enforcementRouter: props.enforcementRouter
        ? {
            ...props.enforcementRouter,
            deviceId: props.enforcementRouter.deviceId?.trim()
          }
        : null
    };
    const error = VendorSettings.validate(normalized);
    if (error) return Result.fail<VendorSettings>(error);
    return Result.ok(new VendorSettings(normalized));
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    props: VendorSettingsProps
  ): VendorSettings {
    return new VendorSettings(props);
  }

  // null when the install is not billed by subscription (INS-021).
  public subscriptionTerms(): SubscriptionTerms | null {
    if (this._props.subscriptionPaidUntil === null) return null;
    const paidThrough = VendorSettings.paidThrough(
      this._props.subscriptionPaidUntil
    );
    if (paidThrough === null) return null;
    const terms = SubscriptionTerms.create(
      paidThrough,
      this._props.subscriptionGraceDays,
      this._props.subscriptionReadOnlyDays
    );
    return terms.isSuccess ? terms.value : null;
  }

  // The midnight after the last paid day, in Colombian time; null for
  // anything that is not a real YYYY-MM-DD date.
  private static paidThrough(lastPaidDay: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastPaidDay);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const utcMidnight = Date.UTC(year, month - 1, day);
    const date = new Date(utcMidnight);
    if (
      date.getUTCDate() !== day ||
      date.getUTCMonth() !== month - 1
    ) {
      return null;
    }
    return new Date(utcMidnight + DAY_MS - INSTALL_UTC_OFFSET_MS);
  }

  private static trimAll<T extends object>(
    group: T | null
  ): T | null {
    if (!group) return null;
    return Object.fromEntries(
      Object.entries(group).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value
      ])
    ) as T;
  }

  private static validate(props: VendorSettingsProps): string | null {
    if (
      props.vendorTelegramChatId !== null &&
      !isTelegramChatId(props.vendorTelegramChatId)
    ) {
      return 'vendorTelegramChatId must be a numeric chat id or a @channel name';
    }
    // The stage lengths are checked even with no date, so turning
    // enforcement on later never meets a bad value.
    const terms = SubscriptionTerms.create(
      new Date(0),
      props.subscriptionGraceDays,
      props.subscriptionReadOnlyDays
    );
    if (terms.isFailure) return terms.error;
    if (
      props.subscriptionPaidUntil !== null &&
      VendorSettings.paidThrough(props.subscriptionPaidUntil) === null
    ) {
      return 'subscriptionPaidUntil must be a real date as YYYY-MM-DD';
    }
    for (const field of RETENTION_FIELDS) {
      const days = props[field];
      if (
        !Number.isInteger(days) ||
        days < 1 ||
        days > MAX_RETENTION_DAYS
      ) {
        return `${field} must be a whole number from 1 to ${MAX_RETENTION_DAYS}`;
      }
    }
    return (
      VendorSettings.validateIssuer(props.issuer) ??
      VendorSettings.validateWhatsApp(props.whatsApp) ??
      VendorSettings.validateEnforcementRouter(
        props.enforcementRouter
      )
    );
  }

  private static validateIssuer(
    issuer: IssuerSettingsProps | null
  ): string | null {
    if (issuer === null) return null;
    for (const field of [
      'name',
      'documentLabel',
      'document',
      'address',
      'city',
      'contactPhone',
      'contactEmail'
    ] as const) {
      const value = issuer[field];
      if (typeof value !== 'string' || value.length === 0) {
        return `issuer.${field} is required`;
      }
      if (value.length > MAX_TEXT) {
        return `issuer.${field} must be at most ${MAX_TEXT} characters`;
      }
    }
    if (!EMAIL.test(issuer.contactEmail)) {
      return 'issuer.contactEmail must be an email address';
    }
    if (!HEX_COLOR.test(issuer.accentColorHex ?? '')) {
      return 'issuer.accentColorHex must be a colour as #RRGGBB';
    }
    return null;
  }

  private static validateWhatsApp(
    whatsApp: WhatsAppSettingsProps | null
  ): string | null {
    if (whatsApp === null) return null;
    const expected: Record<keyof WhatsAppSettingsProps, string> = {
      phoneNumberId: 'digits only',
      templateName: 'lowercase letters, digits and underscores',
      templateLanguage: "a language code such as 'es' or 'es_CO'",
      apiVersion: "a Graph API version such as 'v21.0'"
    };
    for (const field of Object.keys(
      WHATSAPP
    ) as (keyof WhatsAppSettingsProps)[]) {
      if (!WHATSAPP[field].test(whatsApp[field] ?? '')) {
        return `whatsApp.${field} must be ${expected[field]}`;
      }
    }
    return null;
  }

  private static validateEnforcementRouter(
    router: EnforcementRouterSettingsProps | null
  ): string | null {
    if (router === null) return null;
    if (DeviceId.parse(router.deviceId ?? '').isFailure) {
      return 'enforcementRouter.deviceId must be a device id';
    }
    if (
      !Number.isInteger(router.apiPort) ||
      router.apiPort < 1 ||
      router.apiPort > 65535
    ) {
      return 'enforcementRouter.apiPort must be a port from 1 to 65535';
    }
    return null;
  }
}
