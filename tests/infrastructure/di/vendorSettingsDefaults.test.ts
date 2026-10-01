// Source: src/infrastructure/di/vendorSettingsDefaults.ts

import {
  DEFAULT_GRACE_DAYS,
  DEFAULT_READ_ONLY_DAYS,
  loadVendorSettingsDefaults
} from '../../../src/infrastructure/di/vendorSettingsDefaults';

const PAID = { SUBSCRIPTION_PAID_UNTIL: '2026-10-31' };

describe('[INS-029] loadVendorSettingsDefaults', () => {
  it('[INS-021] is not enforced when the paid-until date is unset or blank', () => {
    expect(
      loadVendorSettingsDefaults({}).subscriptionTerms()
    ).toBeNull();
    expect(
      loadVendorSettingsDefaults({
        SUBSCRIPTION_PAID_UNTIL: '  '
      }).subscriptionTerms()
    ).toBeNull();
  });

  it('[INS-021] covers the whole last day in Colombian time', () => {
    const terms = loadVendorSettingsDefaults({
      ...PAID,
      SUBSCRIPTION_GRACE_DAYS: '2',
      SUBSCRIPTION_READ_ONLY_DAYS: '4'
    }).subscriptionTerms()!;

    expect(terms.paidThrough.toISOString()).toBe(
      '2026-11-01T05:00:00.000Z'
    );
    expect(terms.graceDays).toBe(2);
    expect(terms.readOnlyDays).toBe(4);
  });

  it('[INS-021] defaults to 3 grace days and 7 read-only days', () => {
    const settings = loadVendorSettingsDefaults(PAID);

    expect(DEFAULT_GRACE_DAYS).toBe(3);
    expect(DEFAULT_READ_ONLY_DAYS).toBe(7);
    expect(settings.subscriptionGraceDays).toBe(3);
    expect(settings.subscriptionReadOnlyDays).toBe(7);
  });

  it('[INS-021] accepts zero for either stage', () => {
    const terms = loadVendorSettingsDefaults({
      ...PAID,
      SUBSCRIPTION_GRACE_DAYS: '0',
      SUBSCRIPTION_READ_ONLY_DAYS: '0'
    }).subscriptionTerms()!;

    expect(terms.graceDays).toBe(0);
    expect(terms.readOnlyDays).toBe(0);
  });

  it('reads the vendor chat and the retention windows', () => {
    const settings = loadVendorSettingsDefaults({
      TELEGRAM_VENDOR_CHAT_ID: '8468052749',
      PING_RESULT_RETENTION_DAYS: '15',
      ALERT_RETENTION_DAYS: '60',
      WIRELESS_SNAPSHOT_RETENTION_DAYS: '10',
      WIRELESS_ALERT_RECORD_RETENTION_DAYS: '45'
    });

    expect(settings.vendorTelegramChatId).toBe('8468052749');
    expect(settings.pingResultRetentionDays).toBe(15);
    expect(settings.alertRetentionDays).toBe(60);
    expect(settings.wirelessSnapshotRetentionDays).toBe(10);
    expect(settings.wirelessAlertRecordRetentionDays).toBe(45);
  });

  it('falls back to no vendor chat and 30/90/30/90 retention days', () => {
    const settings = loadVendorSettingsDefaults({});

    expect(settings.vendorTelegramChatId).toBeNull();
    expect(settings.pingResultRetentionDays).toBe(30);
    expect(settings.alertRetentionDays).toBe(90);
    expect(settings.wirelessSnapshotRetentionDays).toBe(30);
    expect(settings.wirelessAlertRecordRetentionDays).toBe(90);
  });

  it.each([
    '31/10/2026',
    '2026-02-30',
    '2026-13-01',
    '2026-10-31T00:00'
  ])('[INS-021] stops the boot on a malformed date %s', (raw) => {
    expect(() =>
      loadVendorSettingsDefaults({ SUBSCRIPTION_PAID_UNTIL: raw })
    ).toThrow('SUBSCRIPTION_PAID_UNTIL');
  });

  it.each([
    ['SUBSCRIPTION_GRACE_DAYS', '-1'],
    ['SUBSCRIPTION_GRACE_DAYS', 'seven'],
    ['SUBSCRIPTION_GRACE_DAYS', '91'],
    ['SUBSCRIPTION_READ_ONLY_DAYS', '1.5'],
    ['SUBSCRIPTION_READ_ONLY_DAYS', '91'],
    ['PING_RESULT_RETENTION_DAYS', '0'],
    ['ALERT_RETENTION_DAYS', 'forever'],
    ['TELEGRAM_VENDOR_CHAT_ID', 'my-chat']
  ])('stops the boot on %s=%s, naming the variable', (name, raw) => {
    expect(() =>
      loadVendorSettingsDefaults({ ...PAID, [name]: raw })
    ).toThrow(new RegExp(`^${name}: `));
  });

  describe('[BIL-232] issuer', () => {
    const ISSUER_ENV = {
      ISSUER_NAME: 'Insetel',
      ISSUER_DOCUMENT: '11685533-3',
      ISSUER_ADDRESS: 'Calle 10 # 31-28',
      ISSUER_CITY: 'Villavicencio',
      ISSUER_CONTACT_PHONE: '310 226 3770',
      ISSUER_CONTACT_EMAIL: 'facturacion@insetel.example'
    };

    it('reads all six, with NIT and the default colour', () => {
      expect(loadVendorSettingsDefaults(ISSUER_ENV).issuer).toEqual({
        name: 'Insetel',
        documentLabel: 'NIT',
        document: '11685533-3',
        address: 'Calle 10 # 31-28',
        city: 'Villavicencio',
        contactPhone: '310 226 3770',
        contactEmail: 'facturacion@insetel.example',
        accentColorHex: '#1F4E79'
      });
    });

    it('leaves it unset, for the dashboard, when none is given', () => {
      expect(loadVendorSettingsDefaults({}).issuer).toBeNull();
    });

    it('stops the boot when only some are given, naming the missing ones', () => {
      const { ISSUER_CITY: _city, ...partial } = ISSUER_ENV;

      expect(() => loadVendorSettingsDefaults(partial)).toThrow(
        'The issuer is only partly configured in env; missing ISSUER_CITY'
      );
    });

    it('stops the boot on a bad value, naming the variable', () => {
      expect(() =>
        loadVendorSettingsDefaults({
          ...ISSUER_ENV,
          ISSUER_CONTACT_EMAIL: 'not-an-email'
        })
      ).toThrow(/^ISSUER_CONTACT_EMAIL: /);
    });
  });

  describe('WhatsApp', () => {
    it('reads the phone number and template, with es and v21.0', () => {
      expect(
        loadVendorSettingsDefaults({
          WHATSAPP_PHONE_NUMBER_ID: '123',
          WHATSAPP_TEMPLATE_NAME: 'suspension_notice'
        }).whatsApp
      ).toEqual({
        phoneNumberId: '123',
        templateName: 'suspension_notice',
        templateLanguage: 'es',
        apiVersion: 'v21.0'
      });
    });

    it('stops the boot when only one of the two is given', () => {
      expect(() =>
        loadVendorSettingsDefaults({
          WHATSAPP_PHONE_NUMBER_ID: '123'
        })
      ).toThrow('WhatsApp is only partly configured in env');
    });
  });

  describe('[SVC-060] enforcement router', () => {
    const ROUTER = '550e8400-e29b-41d4-a716-446655440000';

    it('reads the device id, with port 8728 by default', () => {
      expect(
        loadVendorSettingsDefaults({
          ENFORCEMENT_ROUTER_DEVICE_ID: ROUTER
        }).enforcementRouter
      ).toEqual({ deviceId: ROUTER, apiPort: 8728 });
    });

    it('stops the boot on a device id that is not one', () => {
      expect(() =>
        loadVendorSettingsDefaults({
          ENFORCEMENT_ROUTER_DEVICE_ID: 'router-1'
        })
      ).toThrow(/^ENFORCEMENT_ROUTER_DEVICE_ID: /);
    });
  });
});
