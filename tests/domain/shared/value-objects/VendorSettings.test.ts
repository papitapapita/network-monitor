// Source: src/domain/shared/value-objects/VendorSettings.ts

import {
  VendorSettings,
  MAX_RETENTION_DAYS
} from '../../../../src/domain/shared/value-objects/VendorSettings';
import {
  ISSUER,
  WHATSAPP,
  makeVendorSettingsProps
} from '../../../fixtures/vendorSettings';

describe('[INS-028] VendorSettings', () => {
  it('accepts the defaults', () => {
    expect(
      VendorSettings.create(makeVendorSettingsProps()).isSuccess
    ).toBe(true);
  });

  describe('vendorTelegramChatId', () => {
    it('trims it and treats blank as none', () => {
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({
            vendorTelegramChatId: ' 8468052749 '
          })
        ).value.vendorTelegramChatId
      ).toBe('8468052749');
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({ vendorTelegramChatId: '  ' })
        ).value.vendorTelegramChatId
      ).toBeNull();
    });

    it('refuses something Telegram would not accept', () => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({ vendorTelegramChatId: 'jonathan' })
      );

      expect(result.error).toBe(
        'vendorTelegramChatId must be a numeric chat id or a @channel name'
      );
    });
  });

  describe('[INS-021] subscription', () => {
    it('is not enforced with no paid-until date', () => {
      const settings = VendorSettings.create(
        makeVendorSettingsProps()
      ).value;

      expect(settings.subscriptionTerms()).toBeNull();
    });

    it('covers the whole last paid day in Colombian time', () => {
      const terms = VendorSettings.create(
        makeVendorSettingsProps({
          subscriptionPaidUntil: '2026-10-31',
          subscriptionGraceDays: 2,
          subscriptionReadOnlyDays: 4
        })
      ).value.subscriptionTerms()!;

      expect(terms.paidThrough.toISOString()).toBe(
        '2026-11-01T05:00:00.000Z'
      );
      expect(terms.graceEndsAt.toISOString()).toBe(
        '2026-11-03T05:00:00.000Z'
      );
      expect(terms.lockedAt.toISOString()).toBe(
        '2026-11-07T05:00:00.000Z'
      );
    });

    it.each([
      '31/10/2026',
      '2026-02-30',
      '2026-13-01',
      '2026-10-31T00:00'
    ])('refuses the date %s', (date) => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({ subscriptionPaidUntil: date })
      );

      expect(result.error).toBe(
        'subscriptionPaidUntil must be a real date as YYYY-MM-DD'
      );
    });

    it.each([
      ['subscriptionGraceDays', 91, 'Grace days'],
      ['subscriptionReadOnlyDays', -1, 'Read-only days'],
      ['subscriptionGraceDays', 1.5, 'Grace days']
    ] as const)(
      'refuses %s=%d even with no date set',
      (field, value, label) => {
        const result = VendorSettings.create(
          makeVendorSettingsProps({ [field]: value })
        );

        expect(result.error).toBe(
          `${label} must be a whole number from 0 to 90`
        );
      }
    );
  });

  describe('retention windows', () => {
    it.each([1, MAX_RETENTION_DAYS])('accepts %d days', (days) => {
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({ alertRetentionDays: days })
        ).isSuccess
      ).toBe(true);
    });

    it.each([
      ['pingResultRetentionDays', 0],
      ['alertRetentionDays', MAX_RETENTION_DAYS + 1],
      ['wirelessSnapshotRetentionDays', 2.5],
      ['wirelessAlertRecordRetentionDays', NaN]
    ] as const)('refuses %s=%d', (field, value) => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({ [field]: value })
      );

      expect(result.error).toBe(
        `${field} must be a whole number from 1 to ${MAX_RETENTION_DAYS}`
      );
    });
  });

  describe('[BIL-232] issuer', () => {
    it('accepts a complete issuer and trims every field', () => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({
          issuer: { ...ISSUER, city: ' Granada ' }
        })
      );

      expect(result.value.issuer).toEqual({
        ...ISSUER,
        city: 'Granada'
      });
    });

    it.each([
      ['name', '  ', 'issuer.name is required'],
      [
        'contactEmail',
        'cobros',
        'issuer.contactEmail must be an email address'
      ],
      [
        'accentColorHex',
        'blue',
        'issuer.accentColorHex must be a colour as #RRGGBB'
      ],
      [
        'address',
        'x'.repeat(201),
        'issuer.address must be at most 200 characters'
      ]
    ] as const)('refuses issuer.%s=%s', (field, value, message) => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({
          issuer: { ...ISSUER, [field]: value }
        })
      );

      expect(result.error).toBe(message);
    });
  });

  describe('WhatsApp', () => {
    it('accepts the defaults and a regional language', () => {
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({
            whatsApp: { ...WHATSAPP, templateLanguage: 'es_CO' }
          })
        ).isSuccess
      ).toBe(true);
    });

    it.each([
      [
        'phoneNumberId',
        '+57 300',
        'whatsApp.phoneNumberId must be digits only'
      ],
      [
        'templateName',
        'Suspension Notice',
        'whatsApp.templateName must be lowercase letters, digits and underscores'
      ],
      [
        'templateLanguage',
        'spanish',
        "whatsApp.templateLanguage must be a language code such as 'es' or 'es_CO'"
      ],
      [
        'apiVersion',
        '21',
        "whatsApp.apiVersion must be a Graph API version such as 'v21.0'"
      ]
    ] as const)('refuses whatsApp.%s=%s', (field, value, message) => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({
          whatsApp: { ...WHATSAPP, [field]: value }
        })
      );

      expect(result.error).toBe(message);
    });
  });

  describe('[SVC-060] enforcement router', () => {
    const ROUTER = '550e8400-e29b-41d4-a716-446655440000';

    it('accepts a device id and port', () => {
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({
            enforcementRouter: { deviceId: ROUTER, apiPort: 8728 }
          })
        ).value.enforcementRouter
      ).toEqual({ deviceId: ROUTER, apiPort: 8728 });
    });

    it.each([
      [
        { deviceId: 'router-1', apiPort: 8728 },
        'enforcementRouter.deviceId must be a device id'
      ],
      [
        { deviceId: ROUTER, apiPort: 0 },
        'enforcementRouter.apiPort must be a port from 1 to 65535'
      ],
      [
        { deviceId: ROUTER, apiPort: 70000 },
        'enforcementRouter.apiPort must be a port from 1 to 65535'
      ]
    ])('refuses %o', (enforcementRouter, message) => {
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({ enforcementRouter })
        ).error
      ).toBe(message);
    });
  });
});
