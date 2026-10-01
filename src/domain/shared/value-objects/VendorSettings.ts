import { Result } from '../core/Result';
import { ValueObject } from '../core/ValueObject';
import { VendorSettingsProps } from '../props/VendorSettingsProps';
import { SubscriptionTerms } from './SubscriptionTerms';
import { isTelegramChatId } from './TelegramChatId';

export const MAX_RETENTION_DAYS = 3650;
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
        props.subscriptionPaidUntil?.trim() || null
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
    return null;
  }
}
