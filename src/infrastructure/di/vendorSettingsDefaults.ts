import { VendorSettings } from 'domain/shared/value-objects';
import {
  EnforcementRouterSettingsProps,
  IssuerSettingsProps,
  WhatsAppSettingsProps
} from 'domain/shared/props';

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
  ],
  ['issuer.name', 'ISSUER_NAME'],
  ['issuer.documentLabel', 'ISSUER_DOCUMENT_LABEL'],
  ['issuer.document', 'ISSUER_DOCUMENT'],
  ['issuer.address', 'ISSUER_ADDRESS'],
  ['issuer.city', 'ISSUER_CITY'],
  ['issuer.contactPhone', 'ISSUER_CONTACT_PHONE'],
  ['issuer.contactEmail', 'ISSUER_CONTACT_EMAIL'],
  ['issuer.accentColorHex', 'ISSUER_ACCENT_COLOR'],
  ['whatsApp.phoneNumberId', 'WHATSAPP_PHONE_NUMBER_ID'],
  ['whatsApp.templateName', 'WHATSAPP_TEMPLATE_NAME'],
  ['whatsApp.templateLanguage', 'WHATSAPP_TEMPLATE_LANGUAGE'],
  ['whatsApp.apiVersion', 'WHATSAPP_API_VERSION'],
  ['enforcementRouter.deviceId', 'ENFORCEMENT_ROUTER_DEVICE_ID'],
  ['enforcementRouter.apiPort', 'ENFORCEMENT_ROUTER_API_PORT']
];

const ISSUER_REQUIRED = {
  name: 'ISSUER_NAME',
  document: 'ISSUER_DOCUMENT',
  address: 'ISSUER_ADDRESS',
  city: 'ISSUER_CITY',
  contactPhone: 'ISSUER_CONTACT_PHONE',
  contactEmail: 'ISSUER_CONTACT_EMAIL'
} as const;

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
    subscriptionGraceDays: parseNumber(
      env.SUBSCRIPTION_GRACE_DAYS,
      DEFAULT_GRACE_DAYS
    ),
    subscriptionReadOnlyDays: parseNumber(
      env.SUBSCRIPTION_READ_ONLY_DAYS,
      DEFAULT_READ_ONLY_DAYS
    ),
    pingResultRetentionDays: parseNumber(
      env.PING_RESULT_RETENTION_DAYS,
      30
    ),
    alertRetentionDays: parseNumber(env.ALERT_RETENTION_DAYS, 90),
    wirelessSnapshotRetentionDays: parseNumber(
      env.WIRELESS_SNAPSHOT_RETENTION_DAYS,
      30
    ),
    wirelessAlertRecordRetentionDays: parseNumber(
      env.WIRELESS_ALERT_RECORD_RETENTION_DAYS,
      90
    ),
    issuer: loadIssuer(env),
    whatsApp: loadWhatsApp(env),
    enforcementRouter: loadEnforcementRouter(env)
  });
  if (result.isFailure) {
    const name = ENV_NAMES.find(([field]) =>
      result.error.startsWith(field)
    )?.[1];
    throw new Error(`${name ?? 'Vendor settings'}: ${result.error}`);
  }
  return result.value;
}

const read = (env: NodeJS.ProcessEnv, name: string): string =>
  env[name]?.trim() ?? '';

// All six or none: none leaves the issuer to the dashboard (BIL-232); some is
// almost certainly a typo in the env file.
function loadIssuer(
  env: NodeJS.ProcessEnv
): IssuerSettingsProps | null {
  const names = Object.values(ISSUER_REQUIRED);
  const missing = names.filter((name) => !read(env, name));
  if (missing.length === names.length) return null;
  if (missing.length > 0) {
    throw new Error(
      `The issuer is only partly configured in env; missing ${missing.join(', ')}`
    );
  }
  return {
    name: read(env, ISSUER_REQUIRED.name),
    documentLabel: read(env, 'ISSUER_DOCUMENT_LABEL') || 'NIT',
    document: read(env, ISSUER_REQUIRED.document),
    address: read(env, ISSUER_REQUIRED.address),
    city: read(env, ISSUER_REQUIRED.city),
    contactPhone: read(env, ISSUER_REQUIRED.contactPhone),
    contactEmail: read(env, ISSUER_REQUIRED.contactEmail),
    accentColorHex: read(env, 'ISSUER_ACCENT_COLOR') || '#1F4E79'
  };
}

function loadWhatsApp(
  env: NodeJS.ProcessEnv
): WhatsAppSettingsProps | null {
  const phoneNumberId = read(env, 'WHATSAPP_PHONE_NUMBER_ID');
  const templateName = read(env, 'WHATSAPP_TEMPLATE_NAME');
  if (!phoneNumberId && !templateName) return null;
  if (!phoneNumberId || !templateName) {
    throw new Error(
      'WhatsApp is only partly configured in env; set both WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TEMPLATE_NAME'
    );
  }
  return {
    phoneNumberId,
    templateName,
    templateLanguage: read(env, 'WHATSAPP_TEMPLATE_LANGUAGE') || 'es',
    apiVersion: read(env, 'WHATSAPP_API_VERSION') || 'v21.0'
  };
}

function loadEnforcementRouter(
  env: NodeJS.ProcessEnv
): EnforcementRouterSettingsProps | null {
  const deviceId = read(env, 'ENFORCEMENT_ROUTER_DEVICE_ID');
  if (!deviceId) return null;
  return {
    deviceId,
    apiPort: parseNumber(env.ENFORCEMENT_ROUTER_API_PORT, 8728)
  };
}

// Anything but plain digits becomes NaN, which the settings reject.
function parseNumber(
  raw: string | undefined,
  fallback: number
): number {
  const value = raw?.trim();
  if (value === undefined || value === '') return fallback;
  return /^\d+$/.test(value) ? Number(value) : NaN;
}
