import { VendorSettings } from 'domain/shared/value-objects';

export const DEFAULT_GRACE_DAYS = 3;
export const DEFAULT_READ_ONLY_DAYS = 7;

// Each setting's env variable, named in a boot error so the vendor knows which
// line of the env file to fix.
const ENV_NAMES: [string, string][] = [
  ['vendorTelegramChatId', 'TELEGRAM_VENDOR_CHAT_ID'],
  ['subscriptionPaidUntil', 'SUBSCRIPTION_PAID_UNTIL'],
  ['Grace days', 'SUBSCRIPTION_GRACE_DAYS'],
  ['Read-only days', 'SUBSCRIPTION_READ_ONLY_DAYS'],
  ['pingResultRetentionDays', 'PING_RESULT_RETENTION_DAYS'],
  ['alertRetentionDays', 'ALERT_RETENTION_DAYS'],
  [
    'wirelessSnapshotRetentionDays',
    'WIRELESS_SNAPSHOT_RETENTION_DAYS'
  ],
  [
    'wirelessAlertRecordRetentionDays',
    'WIRELESS_ALERT_RECORD_RETENTION_DAYS'
  ]
];

// What applies until the vendor saves the settings from the dashboard
// (INS-029): the env values every install ran on before. SUBSCRIPTION_PAID_UNTIL
// unset means the install is not billed this way — Insetel's own. A value the
// dashboard would refuse stops the boot: guessing a date would either cut off
// a paying customer or never cut off anyone.
export function loadVendorSettingsDefaults(
  env: NodeJS.ProcessEnv
): VendorSettings {
  const result = VendorSettings.create({
    vendorTelegramChatId: env.TELEGRAM_VENDOR_CHAT_ID ?? null,
    subscriptionPaidUntil: env.SUBSCRIPTION_PAID_UNTIL ?? null,
    subscriptionGraceDays: parseDays(
      env.SUBSCRIPTION_GRACE_DAYS,
      DEFAULT_GRACE_DAYS
    ),
    subscriptionReadOnlyDays: parseDays(
      env.SUBSCRIPTION_READ_ONLY_DAYS,
      DEFAULT_READ_ONLY_DAYS
    ),
    pingResultRetentionDays: parseDays(
      env.PING_RESULT_RETENTION_DAYS,
      30
    ),
    alertRetentionDays: parseDays(env.ALERT_RETENTION_DAYS, 90),
    wirelessSnapshotRetentionDays: parseDays(
      env.WIRELESS_SNAPSHOT_RETENTION_DAYS,
      30
    ),
    wirelessAlertRecordRetentionDays: parseDays(
      env.WIRELESS_ALERT_RECORD_RETENTION_DAYS,
      90
    )
  });
  if (result.isFailure) {
    const name = ENV_NAMES.find(([field]) =>
      result.error.startsWith(field)
    )?.[1];
    throw new Error(`${name ?? 'Vendor settings'}: ${result.error}`);
  }
  return result.value;
}

// Anything but plain digits becomes NaN, which the settings reject.
function parseDays(
  raw: string | undefined,
  fallback: number
): number {
  const value = raw?.trim();
  if (value === undefined || value === '') return fallback;
  return /^\d+$/.test(value) ? Number(value) : NaN;
}
