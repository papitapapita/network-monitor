import { Result } from '../../src/domain/shared/core/Result';
import { IVendorSettingsRepository } from '../../src/domain/shared/interfaces/IVendorSettingsRepository';
import { VendorSettings } from '../../src/domain/shared/value-objects/VendorSettings';
import { SubscriptionTerms } from '../../src/domain/shared/value-objects/SubscriptionTerms';
import { VendorSettingsProps } from '../../src/domain/shared/props/VendorSettingsProps';

export function makeVendorSettingsProps(
  overrides: Partial<VendorSettingsProps> = {}
): VendorSettingsProps {
  return {
    vendorTelegramChatId: null,
    subscriptionPaidUntil: null,
    subscriptionGraceDays: 3,
    subscriptionReadOnlyDays: 7,
    pingResultRetentionDays: 30,
    alertRetentionDays: 90,
    wirelessSnapshotRetentionDays: 30,
    wirelessAlertRecordRetentionDays: 90,
    issuer: null,
    whatsApp: null,
    enforcementRouter: null,
    ...overrides
  };
}

export function vendorSettingsRepo(
  overrides: Partial<VendorSettingsProps> = {}
): jest.Mocked<IVendorSettingsRepository> {
  return {
    get: jest
      .fn()
      .mockResolvedValue(
        Result.ok(
          VendorSettings.reconstitute(
            makeVendorSettingsProps(overrides)
          )
        )
      ),
    save: jest.fn().mockResolvedValue(Result.ok())
  };
}

// Terms built to the millisecond (e.g. "ended a day ago"), which a saved
// YYYY-MM-DD date cannot express.
export function vendorSettingsRepoWithTerms(
  terms: SubscriptionTerms | null
): jest.Mocked<IVendorSettingsRepository> {
  const settings = {
    subscriptionTerms: () => terms
  } as unknown as VendorSettings;
  return {
    get: jest.fn().mockResolvedValue(Result.ok(settings)),
    save: jest.fn()
  };
}

export const ISSUER = {
  name: 'Insetel',
  documentLabel: 'NIT',
  document: '11685533-3',
  address: 'Calle 10 # 31-28',
  city: 'Villavicencio',
  contactPhone: '310 226 3770',
  contactEmail: 'facturacion@insetel.example',
  accentColorHex: '#1F4E79'
};

export const WHATSAPP = {
  phoneNumberId: '123456789',
  templateName: 'suspension_notice',
  templateLanguage: 'es',
  apiVersion: 'v21.0'
};
